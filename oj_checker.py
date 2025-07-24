"""
OJ Checker Module - Official Journal Harmonized Standards Checker
"""

import re
import logging
from typing import List, Dict, Optional
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import pandas as pd
import PyPDF2
import io

from config import DIRECTIVE_URLS, DIRECTIVE_INFO, HTTP_CONFIG, EUR_LEX_URLS
from data_models import Standard, ProcessingResult
from utils import (
    setup_logging, create_http_session, normalize_standard_number,
    extract_version_from_standard, create_cache_key, save_to_cache,
    load_from_cache, clean_html_text, retry_on_failure, debug_log
)


class OJChecker:
    """Official Journal Harmonized Standards Checker"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.session = create_http_session()
        self.directive_urls = DIRECTIVE_URLS
        self.directive_info = DIRECTIVE_INFO
        self.eur_lex_urls = EUR_LEX_URLS
        
    def fetch_standards(self, directive: str) -> ProcessingResult:
        """指定されたDirectiveの規格を取得"""
        debug_log(f"=== Starting fetch_standards for directive: {directive} ===", "general")
        
        if directive not in self.directive_urls:
            debug_log(f"ERROR: Unknown directive {directive}", "general")
            return ProcessingResult(
                success=False,
                error_message=f"Unknown directive: {directive}"
            )
        
        try:
            self.logger.info(f"Fetching standards for {directive} directive")
            debug_log(f"Available directive URLs: {list(self.directive_urls.keys())}", "general")
            debug_log(f"EUR-Lex configuration for {directive}: {self.eur_lex_urls.get(directive, 'Not configured')}", "general")
            
            # キャッシュから確認
            cache_key = create_cache_key("oj_standards", directive)
            debug_log(f"Generated cache key: {cache_key}", "general")
            cached_data = load_from_cache(cache_key)
            
            if cached_data:
                self.logger.info(f"Using cached data for {directive}")
                debug_log(f"Cache hit! Found {len(cached_data)} cached standards", "general")
                return ProcessingResult(success=True, data=cached_data)
            
            debug_log("No cache found, proceeding with fresh data fetch", "general")
            
            # 優先順位に従って取得を試行
            standards = []
            debug_log("=== Starting multi-source data fetch ===", "general")
            
            # 1. EUR-Lexから全てのOJ文書を取得
            debug_log("STEP 1: Fetching from EUR-Lex sources", "general")
            eur_lex_standards = self._fetch_from_eur_lex(directive)
            if eur_lex_standards:
                standards.extend(eur_lex_standards)
                self.logger.info(f"Fetched {len(eur_lex_standards)} standards from EUR-Lex")
                debug_log(f"EUR-Lex fetch successful: {len(eur_lex_standards)} standards", "general")
            else:
                debug_log("EUR-Lex fetch returned no standards", "general")
            
            # 2. EC WebページからPDF/Excel文書を取得
            debug_log("STEP 2: Fetching from EC webpage", "general")
            ec_standards = self._fetch_from_ec_webpage(directive)
            if ec_standards:
                standards.extend(ec_standards)
                self.logger.info(f"Fetched {len(ec_standards)} standards from EC webpage")
                debug_log(f"EC webpage fetch successful: {len(ec_standards)} standards", "general")
            else:
                debug_log("EC webpage fetch returned no standards", "general")
            
            # 3. 重複除去
            if standards:
                debug_log(f"STEP 3: Deduplicating {len(standards)} total standards", "general")
                unique_standards = self._deduplicate_standards(standards)
                self.logger.info(f"After deduplication: {len(unique_standards)} unique standards")
                debug_log(f"Deduplication result: {len(standards)} -> {len(unique_standards)} standards", "general")
                
                # 4. 規格番号でソート
                debug_log("STEP 4: Sorting standards by number", "general")
                sorted_standards = self._sort_standards_by_number(unique_standards)
                self.logger.info(f"Standards sorted by number")
                debug_log(f"First 5 sorted standards: {[s.number for s in sorted_standards[:5]]}", "general")
                
                # キャッシュに保存
                debug_log(f"STEP 5: Saving {len(sorted_standards)} standards to cache", "general")
                save_to_cache(cache_key, sorted_standards)
                debug_log("=== fetch_standards completed successfully ===", "general")
                return ProcessingResult(success=True, data=sorted_standards)
            
            # 4. 全て失敗した場合はサンプルデータを使用
            self.logger.warning(f"All fetch methods failed for {directive}, using sample data")
            from sample_data import get_sample_standards_for_directive
            sample_standards = get_sample_standards_for_directive(directive)
            
            if sample_standards:
                self.logger.info(f"Using {len(sample_standards)} sample standards for {directive}")
                # サンプルデータもソート
                sorted_sample_standards = self._sort_standards_by_number(sample_standards)
                # サンプルデータをキャッシュに保存
                save_to_cache(cache_key, sorted_sample_standards)
                return ProcessingResult(success=True, data=sorted_sample_standards)
            else:
                return ProcessingResult(
                    success=False,
                    error_message=f"No standards found for {directive}"
                )
                
        except Exception as e:
            self.logger.error(f"Error fetching standards for {directive}: {str(e)}")
            return ProcessingResult(
                success=False,
                error_message=f"Failed to fetch standards: {str(e)}"
            )
    
    @retry_on_failure(max_attempts=3, delay=2)
    def _fetch_from_webpage(self, url: str, directive: str) -> List[Standard]:
        """Webページから規格情報を取得"""
        response = self.session.get(url, timeout=HTTP_CONFIG['timeout'])
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        standards = []
        
        # PDF/XLSリンクを探す
        pdf_links = self._find_document_links(soup)
        
        for link in pdf_links:
            try:
                document_standards = self._parse_document(link, directive)
                standards.extend(document_standards)
            except Exception as e:
                self.logger.warning(f"Failed to parse document {link}: {str(e)}")
                continue
        
        # 重複除去
        unique_standards = self._deduplicate_standards(standards)
        
        return unique_standards
    
    def _find_document_links(self, soup: BeautifulSoup) -> List[str]:
        """PDF/XLSドキュメントリンクを探す"""
        links = []
        
        # PDF/XLSリンクを探すパターン
        link_patterns = [
            r'.*\.pdf$',
            r'.*\.xls$',
            r'.*\.xlsx$'
        ]
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            for pattern in link_patterns:
                if re.match(pattern, href, re.IGNORECASE):
                    # 相対URLを絶対URLに変換
                    if href.startswith('/'):
                        href = 'https://single-market-economy.ec.europa.eu' + href
                    elif not href.startswith('http'):
                        href = 'https://single-market-economy.ec.europa.eu/' + href
                    links.append(href)
                    break
        
        return list(set(links))  # 重複除去
    
    def _parse_document(self, doc_url: str, directive: str) -> List[Standard]:
        """ドキュメントから規格情報を解析"""
        self.logger.info(f"Parsing document: {doc_url}")
        
        try:
            response = self.session.get(doc_url, timeout=HTTP_CONFIG['timeout'])
            response.raise_for_status()
            
            if doc_url.lower().endswith('.pdf'):
                return self._parse_pdf_document(response.content, directive)
            elif doc_url.lower().endswith(('.xls', '.xlsx')):
                return self._parse_excel_document(response.content, directive)
            else:
                self.logger.warning(f"Unsupported document type: {doc_url}")
                return []
                
        except Exception as e:
            self.logger.error(f"Error parsing document {doc_url}: {str(e)}")
            return []
    
    def _parse_pdf_document(self, pdf_content: bytes, directive: str) -> List[Standard]:
        """PDFドキュメントから規格情報を解析"""
        standards = []
        
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            
            full_text = ""
            for page in pdf_reader.pages:
                full_text += page.extract_text()
            
            # 規格番号パターンを検索
            standard_patterns = [
                r'EN\s+\d+\s+\d+(?:-\d+)*\s+V\d+\.\d+\.\d+',
                r'EN\s+\d+\s+\d+(?:-\d+)*(?:\s+\(\d{4}\))?',
                r'ETSI\s+EN\s+\d+\s+\d+(?:-\d+)*\s+V\d+\.\d+\.\d+',
                r'ETSI\s+EN\s+\d+\s+\d+(?:-\d+)*(?:\s+\(\d{4}\))?'
            ]
            
            for pattern in standard_patterns:
                matches = re.findall(pattern, full_text, re.IGNORECASE)
                for match in matches:
                    number, version = extract_version_from_standard(match)
                    if number:
                        # ステータスと日付情報を抽出
                        status_info = self._extract_status_info(match, full_text, "PDF Document")
                        
                        standard = Standard(
                            number=number,
                            version=version,
                            directive=directive,
                            title=self._extract_title_from_text(match, full_text),
                            status=status_info.get('status', 'Active'),
                            publication_date=status_info.get('publication_date', datetime.now().strftime("%Y-%m-%d")),
                            amendment_date=status_info.get('amendment_date', ''),
                            withdrawal_date=status_info.get('withdrawal_date', ''),
                            superseded_by=status_info.get('superseded_by', ''),
                            oj_reference=status_info.get('oj_reference', '')
                        )
                        standards.append(standard)
            
        except Exception as e:
            self.logger.error(f"Error parsing PDF: {str(e)}")
        
        return standards
    
    def _parse_excel_document(self, excel_content: bytes, directive: str) -> List[Standard]:
        """Excelドキュメントから規格情報を解析"""
        standards = []
        
        try:
            df = pd.read_excel(io.BytesIO(excel_content))
            
            # 一般的な列名パターン
            number_columns = ['Standard', 'Reference', 'Number', 'EN', 'ETSI']
            title_columns = ['Title', 'Name', 'Description']
            version_columns = ['Version', 'Ver', 'V']
            
            number_col = None
            title_col = None
            version_col = None
            
            # 適切な列を探す
            for col in df.columns:
                col_lower = str(col).lower()
                if any(pattern.lower() in col_lower for pattern in number_columns):
                    number_col = col
                elif any(pattern.lower() in col_lower for pattern in title_columns):
                    title_col = col
                elif any(pattern.lower() in col_lower for pattern in version_columns):
                    version_col = col
            
            if number_col is None:
                self.logger.warning("Could not find standard number column in Excel")
                return []
            
            for _, row in df.iterrows():
                try:
                    number = str(row[number_col]).strip()
                    if not number or number.lower() in ['nan', 'none', '']:
                        continue
                    
                    # 規格番号を正規化
                    number, version = extract_version_from_standard(number)
                    
                    # バージョンが別列にある場合
                    if version_col and not version:
                        version_value = str(row[version_col]).strip()
                        if version_value and version_value.lower() not in ['nan', 'none', '']:
                            version = version_value
                    
                    # タイトルを取得
                    title = ""
                    if title_col:
                        title = str(row[title_col]).strip()
                        if title.lower() in ['nan', 'none']:
                            title = ""
                    
                    # Excel文書の場合、ステータス情報をより詳細に抽出
                    status_info = self._extract_status_info_from_excel_row(row, number)
                    
                    standard = Standard(
                        number=number,
                        version=version,
                        directive=directive,
                        title=title,
                        status=status_info.get('status', 'Active'),
                        publication_date=status_info.get('publication_date', datetime.now().strftime("%Y-%m-%d")),
                        amendment_date=status_info.get('amendment_date', ''),
                        withdrawal_date=status_info.get('withdrawal_date', ''),
                        superseded_by=status_info.get('superseded_by', ''),
                        oj_reference=status_info.get('oj_reference', '')
                    )
                    standards.append(standard)
                    
                except Exception as e:
                    self.logger.warning(f"Error parsing Excel row: {str(e)}")
                    continue
            
        except Exception as e:
            self.logger.error(f"Error parsing Excel: {str(e)}")
        
        return standards
    
    def _extract_title_from_text(self, standard_match: str, full_text: str) -> str:
        """テキストから規格タイトルを抽出"""
        try:
            # 規格番号の後にあるテキストを探す
            pattern = re.escape(standard_match) + r'[^\n]*'
            match = re.search(pattern, full_text, re.IGNORECASE)
            
            if match:
                line = match.group()
                # 規格番号以降のテキストを取得
                title = line[len(standard_match):].strip()
                # 長すぎる場合は切り詰め
                if len(title) > 100:
                    title = title[:100] + "..."
                return title
            
        except Exception:
            pass
        
        return ""
    
    def _deduplicate_standards(self, standards: List[Standard]) -> List[Standard]:
        """重複する規格を除去（バージョン情報がある方を優先）"""
        standard_map = {}
        
        for standard in standards:
            base_number = standard.number
            
            # 既に同じ番号の規格がある場合
            if base_number in standard_map:
                existing = standard_map[base_number]
                
                # バージョン情報がある方を優先
                if standard.version and not existing.version:
                    standard_map[base_number] = standard
                elif not standard.version and existing.version:
                    # 既存の方がバージョンありなのでそのまま
                    continue
                elif standard.version and existing.version:
                    # 両方バージョンありの場合、より新しいバージョンを優先
                    if self._compare_versions(standard.version, existing.version) > 0:
                        standard_map[base_number] = standard
            else:
                standard_map[base_number] = standard
        
        return list(standard_map.values())
    
    def _compare_versions(self, version1: str, version2: str) -> int:
        """バージョン番号を比較（1が新しい場合は正の値を返す）"""
        try:
            # V1.2.3形式からバージョン番号を抽出
            v1_match = re.search(r'V?(\d+)\.(\d+)\.(\d+)', version1)
            v2_match = re.search(r'V?(\d+)\.(\d+)\.(\d+)', version2)
            
            if v1_match and v2_match:
                v1_parts = [int(x) for x in v1_match.groups()]
                v2_parts = [int(x) for x in v2_match.groups()]
                
                # 各部分を比較
                for i in range(3):
                    if v1_parts[i] > v2_parts[i]:
                        return 1
                    elif v1_parts[i] < v2_parts[i]:
                        return -1
                return 0
            else:
                # 文字列として比較
                return 1 if version1 > version2 else (-1 if version1 < version2 else 0)
        except Exception:
            return 0
    
    def get_all_standards(self) -> Dict[str, List[Standard]]:
        """全てのDirectiveの規格を取得"""
        all_standards = {}
        
        for directive in self.directive_urls.keys():
            result = self.fetch_standards(directive)
            if result.success:
                # fetch_standardsでソート済みなのでそのまま使用
                all_standards[directive] = result.data
            else:
                self.logger.error(f"Failed to fetch {directive}: {result.error_message}")
                all_standards[directive] = []
        
        return all_standards
    
    def format_standards_display(self, standards: List[Standard]) -> str:
        """規格を表示用にフォーマット"""
        if not standards:
            return "No standards found."
        
        formatted = []
        for standard in standards:
            version_str = f" {standard.version}" if standard.version else ""
            title_str = f" - {standard.title}" if standard.title else ""
            
            # ステータス情報を追加
            status_str = ""
            if standard.status != "Active":
                status_str = f" [{standard.status}]"
                if standard.withdrawal_date:
                    status_str += f" (Withdrawn: {standard.withdrawal_date})"
                if standard.superseded_by:
                    status_str += f" (Superseded by: {standard.superseded_by})"
            
            # OJ参照を追加
            oj_str = ""
            if standard.oj_reference:
                oj_str = f" ({standard.oj_reference})"
            
            formatted.append(f"{standard.number}{version_str}{title_str}{status_str}{oj_str}")
        
        return "\n".join(formatted)
    
    def search_standards(self, query: str, directive: str = None) -> List[Standard]:
        """規格を検索"""
        if directive:
            result = self.fetch_standards(directive)
            if result.success:
                standards = result.data
            else:
                return []
        else:
            all_standards = self.get_all_standards()
            standards = []
            for std_list in all_standards.values():
                standards.extend(std_list)
        
        # 検索実行
        query_lower = query.lower()
        matching_standards = []
        
        for standard in standards:
            if (query_lower in standard.number.lower() or 
                query_lower in standard.title.lower()):
                matching_standards.append(standard)
        
        # 検索結果もソート
        return self._sort_standards_by_number(matching_standards)
    
    def _fetch_from_eur_lex(self, directive: str) -> List[Standard]:
        """EUR-Lexから規格情報を取得"""
        debug_log(f"Starting EUR-Lex fetch for directive: {directive}", "url")
        
        if directive not in self.eur_lex_urls:
            self.logger.warning(f"No EUR-Lex URL configured for {directive}")
            debug_log(f"No EUR-Lex configuration found for {directive}", "url")
            return []
        
        standards = []
        eur_lex_config = self.eur_lex_urls[directive]
        debug_log(f"EUR-Lex config: {eur_lex_config}", "url")
        
        try:
            # メインのDecisionから取得
            debug_log(f"Fetching main decision from: {eur_lex_config['main']}", "url")
            main_standards = self._parse_eur_lex_page(eur_lex_config['main'], directive)
            standards.extend(main_standards)
            self.logger.info(f"Fetched {len(main_standards)} standards from main EUR-Lex document")
            debug_log(f"Main document parsed: {len(main_standards)} standards found", "parsing")
            
            # Amendmentsから取得
            amendments = eur_lex_config.get('amendments', [])
            debug_log(f"Processing {len(amendments)} amendments", "url")
            
            for i, amendment_url in enumerate(amendments):
                debug_log(f"Fetching amendment {i+1} from: {amendment_url}", "url")
                amendment_standards = self._parse_eur_lex_page(amendment_url, directive)
                standards.extend(amendment_standards)
                self.logger.info(f"Fetched {len(amendment_standards)} standards from amendment {i+1}")
                debug_log(f"Amendment {i+1} parsed: {len(amendment_standards)} standards found", "parsing")
            
            # 重複除去
            debug_log(f"Pre-deduplication total: {len(standards)} standards", "parsing")
            unique_standards = self._deduplicate_standards(standards)
            debug_log(f"Post-deduplication: {len(unique_standards)} unique standards", "parsing")
            
            self.logger.info(f"Successfully fetched {len(unique_standards)} unique standards from EUR-Lex for {directive}")
            debug_log(f"EUR-Lex fetch completed successfully for {directive}", "url")
            return unique_standards
            
        except Exception as e:
            self.logger.error(f"Error fetching from EUR-Lex for {directive}: {str(e)}")
            debug_log(f"ERROR in EUR-Lex fetch: {str(e)}", "url")
            return []
    
    def _fetch_from_ec_webpage(self, directive: str) -> List[Standard]:
        """ECウェブページから規格情報を取得"""
        if directive not in self.eur_lex_urls:
            self.logger.warning(f"No EC webpage URL configured for {directive}")
            return []
        
        ec_url = self.eur_lex_urls[directive].get('ec_webpage')
        if not ec_url:
            self.logger.warning(f"No EC webpage URL configured for {directive}")
            return []
        
        try:
            self.logger.info(f"Fetching standards from EC webpage: {ec_url}")
            
            response = self.session.get(ec_url, timeout=HTTP_CONFIG['timeout'])
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            standards = []
            
            # PDF/XLSリンクを探す
            document_links = self._find_document_links(soup)
            self.logger.info(f"Found {len(document_links)} document links on EC webpage")
            
            for link in document_links:
                try:
                    document_standards = self._parse_document(link, directive)
                    standards.extend(document_standards)
                    self.logger.info(f"Parsed {len(document_standards)} standards from {link}")
                except Exception as e:
                    self.logger.warning(f"Failed to parse document {link}: {str(e)}")
                    continue
            
            # テーブルからも直接抽出を試行
            table_standards = self._extract_from_ec_tables(soup, directive)
            if table_standards:
                standards.extend(table_standards)
                self.logger.info(f"Extracted {len(table_standards)} standards from EC webpage tables")
            
            # 重複除去
            unique_standards = self._deduplicate_standards(standards)
            
            self.logger.info(f"Successfully fetched {len(unique_standards)} unique standards from EC webpage")
            return unique_standards
            
        except Exception as e:
            self.logger.error(f"Error fetching from EC webpage for {directive}: {str(e)}")
            return []
    
    @retry_on_failure(max_attempts=3, delay=2)
    def _parse_eur_lex_page(self, url: str, directive: str) -> List[Standard]:
        """EUR-Lexページから規格情報を解析"""
        self.logger.info(f"Parsing EUR-Lex page: {url}")
        debug_log(f"Starting to parse EUR-Lex page: {url}", "parsing")
        
        response = self.session.get(url, timeout=HTTP_CONFIG['timeout'])
        response.raise_for_status()
        debug_log(f"HTTP response received: {response.status_code}, Content-Length: {len(response.content)}", "url")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        debug_log(f"HTML parsed successfully, looking for standards", "parsing")
        standards = []
        
        # EUR-Lexページの構造に基づいて規格を抽出
        # テーブル構造を探す
        tables = soup.find_all('table')
        debug_log(f"Found {len(tables)} tables in the page", "parsing")
        
        for i, table in enumerate(tables):
            debug_log(f"Processing table {i+1}", "parsing")
            table_standards = self._parse_eur_lex_table(table, directive, url)
            standards.extend(table_standards)
            debug_log(f"Table {i+1} yielded {len(table_standards)} standards", "extraction")
        
        # テーブルが見つからない場合は、テキストから直接抽出
        if not standards:
            debug_log("No standards found in tables, trying text extraction", "parsing")
            text_content = soup.get_text()
            debug_log(f"Full text length: {len(text_content)} characters", "parsing")
            standards = self._extract_standards_from_text(text_content, directive)
            debug_log(f"Text extraction yielded {len(standards)} standards", "extraction")
        
        debug_log(f"Page parsing completed: {len(standards)} total standards found", "parsing")
        return standards
    
    def _parse_eur_lex_table(self, table, directive: str, url: str = "") -> List[Standard]:
        """EUR-Lexテーブルから規格情報を解析"""
        standards = []
        
        # テーブルの行を処理
        rows = table.find_all('tr')
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            
            if len(cells) < 2:
                continue
            
            # 規格番号を含む可能性のあるセルを探す
            for cell in cells:
                text = cell.get_text().strip()
                
                # 規格番号パターンをチェック
                standard_matches = self._find_standard_numbers_in_text(text)
                
                for match in standard_matches:
                    number, version = extract_version_from_standard(match)
                    if number:
                        # タイトルを次のセルから取得を試行
                        title = self._extract_title_from_row(row, cells.index(cell))
                        
                        # EUR-Lexテーブルからステータス情報を抽出
                        status_info = self._extract_status_info_from_table_row(row, number, url)
                        
                        standard = Standard(
                            number=number,
                            version=version,
                            directive=directive,
                            title=title,
                            status=status_info.get('status', 'Active'),
                            publication_date=status_info.get('publication_date', datetime.now().strftime("%Y-%m-%d")),
                            amendment_date=status_info.get('amendment_date', ''),
                            withdrawal_date=status_info.get('withdrawal_date', ''),
                            superseded_by=status_info.get('superseded_by', ''),
                            oj_reference=status_info.get('oj_reference', '')
                        )
                        standards.append(standard)
        
        return standards
    
    def _extract_standards_from_text(self, text: str, directive: str) -> List[Standard]:
        """テキストから規格番号を抽出"""
        standards = []
        
        # 規格番号パターンを検索
        standard_matches = self._find_standard_numbers_in_text(text)
        
        for match in standard_matches:
            number, version = extract_version_from_standard(match)
            if number:
                title = self._extract_title_from_text(match, text)
                
                standard = Standard(
                    number=number,
                    version=version,
                    directive=directive,
                    title=title,
                    status="Active",
                    publication_date=datetime.now().strftime("%Y-%m-%d"),
                    amendment_date=""
                )
                standards.append(standard)
        
        return standards
    
    def _find_standard_numbers_in_text(self, text: str) -> List[str]:
        """テキストから規格番号を検索"""
        matches = []
        
        # Unicode文字の正規化（ノンブレークスペースなど）
        normalized_text = text.replace('\xa0', ' ')  # ノンブレークスペースを通常のスペースに
        normalized_text = re.sub(r'\s+', ' ', normalized_text)  # 複数のスペースを1つに
        
        # より柔軟な規格番号パターン
        eur_lex_patterns = [
            # EN + 数字（1つ以上）+ オプションのバージョン
            r'EN\s+\d+(?:\s+\d+)*(?:-\d+)*(?:\s+V\d+\.\d+\.\d+)?',
            # ETSI EN + 数字（1つ以上）+ オプションのバージョン  
            r'ETSI\s+EN\s+\d+(?:\s+\d+)*(?:-\d+)*(?:\s+V\d+\.\d+\.\d+)?',
            # EN + 数字（1つ以上）+ 年号
            r'EN\s+\d+(?:\s+\d+)*(?:-\d+)*(?:\s+\(\d{4}\))?',
            # EN ISO + 数字 + オプションの年号（コロンまたは括弧）
            r'EN\s+ISO\s+\d+(?:-\d+)*(?::\d{4})?(?:\s+\(\d{4}\))?',
            # EN IEC + 数字 + オプションの年号（コロンまたは括弧）
            r'EN\s+IEC\s+\d+(?:-\d+)*(?::\d{4})?(?:\s+\(\d{4}\))?',
            # より短い形式の EN + 数字
            r'EN\s+\d+(?:-\d+)*',
            # ETSI TS形式
            r'ETSI\s+TS\s+\d+(?:\s+\d+)*(?:-\d+)*(?:\s+V\d+\.\d+\.\d+)?'
        ]
        
        debug_log(f"Searching for standards in text of length {len(text)}", "extraction")
        debug_log(f"Normalized text sample: {normalized_text[:100]}...", "extraction")
        
        for i, pattern in enumerate(eur_lex_patterns):
            pattern_matches = re.findall(pattern, normalized_text, re.IGNORECASE)
            # 重複除去しながら追加
            for match in pattern_matches:
                if match not in matches:
                    matches.append(match)
            debug_log(f"Pattern {i+1} '{pattern}' found {len(pattern_matches)} matches", "extraction")
            if pattern_matches:
                debug_log(f"Pattern {i+1} matches: {pattern_matches[:5]}{'...' if len(pattern_matches) > 5 else ''}", "extraction")
        
        debug_log(f"Total unique matches found: {len(matches)}", "extraction")
        return matches
    
    def _extract_title_from_row(self, row, standard_cell_index: int) -> str:
        """テーブル行から規格タイトルを抽出"""
        cells = row.find_all(['td', 'th'])
        
        # 規格番号の次のセルをタイトルとして取得
        if standard_cell_index + 1 < len(cells):
            title_cell = cells[standard_cell_index + 1]
            title = clean_html_text(title_cell.get_text())
            
            # 長すぎる場合は切り詰め
            if len(title) > 150:
                title = title[:150] + "..."
            
            return title
        
        return ""
    
    def _extract_from_ec_tables(self, soup: BeautifulSoup, directive: str) -> List[Standard]:
        """ECウェブページのテーブルから規格情報を抽出"""
        standards = []
        
        try:
            # テーブルを探す
            tables = soup.find_all('table')
            
            for table in tables:
                # テーブルの行を処理
                rows = table.find_all('tr')
                
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    
                    if len(cells) < 2:
                        continue
                    
                    # 各セルで規格番号を探す
                    for i, cell in enumerate(cells):
                        cell_text = cell.get_text().strip()
                        
                        # 規格番号パターンをチェック
                        standard_matches = self._find_standard_numbers_in_text(cell_text)
                        
                        for match in standard_matches:
                            number, version = extract_version_from_standard(match)
                            if number:
                                # タイトルを隣のセルから取得
                                title = ""
                                if i + 1 < len(cells):
                                    title = clean_html_text(cells[i + 1].get_text())
                                    if len(title) > 200:
                                        title = title[:200] + "..."
                                
                                # 日付情報を探す
                                date_info = self._extract_date_from_row(row)
                                
                                # ECテーブルからステータス情報を抽出
                                status_info = self._extract_status_info_from_table_row(row, number, "EC Webpage")
                                
                                standard = Standard(
                                    number=number,
                                    version=version,
                                    directive=directive,
                                    title=title,
                                    status=status_info.get('status', 'Active'),
                                    publication_date=status_info.get('publication_date') or date_info.get('publication', datetime.now().strftime("%Y-%m-%d")),
                                    amendment_date=status_info.get('amendment_date') or date_info.get('amendment', ""),
                                    withdrawal_date=status_info.get('withdrawal_date', ''),
                                    superseded_by=status_info.get('superseded_by', ''),
                                    oj_reference=status_info.get('oj_reference', '')
                                )
                                
                                standards.append(standard)
            
            return standards
            
        except Exception as e:
            self.logger.error(f"Error extracting from EC tables: {str(e)}")
            return []
    
    def _extract_date_from_row(self, row) -> Dict[str, str]:
        """テーブル行から日付情報を抽出"""
        date_info = {'publication': '', 'amendment': ''}
        
        try:
            row_text = row.get_text()
            
            # 日付パターンを探す
            date_patterns = [
                r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})',  # MM/DD/YYYY or DD/MM/YYYY
                r'(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})',  # YYYY/MM/DD
                r'(\d{1,2}\s+\w+\s+\d{4})',           # DD Month YYYY
                r'(\w+\s+\d{1,2},?\s+\d{4})'          # Month DD, YYYY
            ]
            
            for pattern in date_patterns:
                matches = re.findall(pattern, row_text)
                if matches:
                    # 最初の日付を公開日として使用
                    date_info['publication'] = matches[0]
                    break
            
            # Amendment日付を探す
            if 'amendment' in row_text.lower() or 'amend' in row_text.lower():
                for pattern in date_patterns:
                    matches = re.findall(pattern, row_text)
                    if matches:
                        date_info['amendment'] = matches[-1]  # 最後の日付をamendment日として使用
                        break
            
        except Exception:
            pass
        
        return date_info
    
    def _extract_status_info(self, standard_match: str, full_text: str, source_url: str) -> Dict[str, str]:
        """規格のステータスと日付情報を抽出"""
        status_info = {
            'status': 'Active',
            'publication_date': '',
            'amendment_date': '',
            'withdrawal_date': '',
            'superseded_by': '',
            'oj_reference': ''
        }
        
        try:
            # OJ参照番号を生成
            status_info['oj_reference'] = self._extract_oj_reference_from_url(source_url)
            
            # 規格の周辺テキストを取得
            pattern = re.escape(standard_match)
            match = re.search(f'.{{0,200}}{pattern}.{{0,200}}', full_text, re.IGNORECASE)
            
            if match:
                context = match.group()
                
                # ステータス判定
                if any(word in context.lower() for word in ['withdraw', 'withdrawn', 'superseded', 'replaced']):
                    status_info['status'] = 'Withdrawn'
                elif any(word in context.lower() for word in ['supersede', 'replace']):
                    status_info['status'] = 'Superseded'
                
                # 日付抽出
                date_patterns = [
                    r'(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})',
                    r'(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})',
                    r'(\d{1,2}\s+\w+\s+\d{4})',
                    r'(\w+\s+\d{1,2},?\s+\d{4})'
                ]
                
                for pattern in date_patterns:
                    dates = re.findall(pattern, context)
                    if dates:
                        # 最初の日付を公開日として使用
                        status_info['publication_date'] = dates[0]
                        # 最後の日付をamendment日として使用
                        if len(dates) > 1:
                            status_info['amendment_date'] = dates[-1]
                        break
                
                # 後継規格を探す
                superseded_patterns = [
                    r'superseded by\s+(EN\s+\d+[\d\s\-]*)',
                    r'replaced by\s+(EN\s+\d+[\d\s\-]*)',
                    r'see\s+(EN\s+\d+[\d\s\-]*)'
                ]
                
                for pattern in superseded_patterns:
                    match = re.search(pattern, context, re.IGNORECASE)
                    if match:
                        status_info['superseded_by'] = match.group(1).strip()
                        break
            
        except Exception as e:
            self.logger.warning(f"Error extracting status info: {str(e)}")
        
        return status_info
    
    def _extract_status_info_from_excel_row(self, row, standard_number: str) -> Dict[str, str]:
        """Excelの行からステータス情報を抽出"""
        status_info = {
            'status': 'Active',
            'publication_date': '',
            'amendment_date': '',
            'withdrawal_date': '',
            'superseded_by': '',
            'oj_reference': ''
        }
        
        try:
            # 行の全テキストを取得
            row_text = ' '.join(str(cell) for cell in row.values if str(cell).lower() not in ['nan', 'none', ''])
            
            # ステータス判定
            if any(word in row_text.lower() for word in ['withdraw', 'withdrawn', 'superseded', 'replaced']):
                status_info['status'] = 'Withdrawn'
            elif any(word in row_text.lower() for word in ['supersede', 'replace']):
                status_info['status'] = 'Superseded'
            
            # 日付抽出
            date_patterns = [
                r'(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})',
                r'(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})',
                r'(\d{1,2}\s+\w+\s+\d{4})',
                r'(\w+\s+\d{1,2},?\s+\d{4})'
            ]
            
            for pattern in date_patterns:
                dates = re.findall(pattern, row_text)
                if dates:
                    status_info['publication_date'] = dates[0]
                    if len(dates) > 1:
                        status_info['amendment_date'] = dates[-1]
                    break
            
        except Exception as e:
            self.logger.warning(f"Error extracting status from Excel row: {str(e)}")
        
        return status_info
    
    def _extract_status_info_from_table_row(self, row, standard_number: str, source_url: str) -> Dict[str, str]:
        """テーブル行からステータス情報を抽出"""
        status_info = {
            'status': 'Active',
            'publication_date': '',
            'amendment_date': '',
            'withdrawal_date': '',
            'superseded_by': '',
            'oj_reference': self._extract_oj_reference_from_url(source_url)
        }
        
        try:
            # 行の全テキストを取得
            row_text = row.get_text() if hasattr(row, 'get_text') else str(row)
            
            # ステータス判定
            if any(word in row_text.lower() for word in ['withdraw', 'withdrawn', 'superseded', 'replaced']):
                status_info['status'] = 'Withdrawn'
            elif any(word in row_text.lower() for word in ['supersede', 'replace']):
                status_info['status'] = 'Superseded'
            
            # 日付抽出
            date_patterns = [
                r'(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})',
                r'(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})',
                r'(\d{1,2}\s+\w+\s+\d{4})',
                r'(\w+\s+\d{1,2},?\s+\d{4})'
            ]
            
            for pattern in date_patterns:
                dates = re.findall(pattern, row_text)
                if dates:
                    status_info['publication_date'] = dates[0]
                    if len(dates) > 1:
                        status_info['amendment_date'] = dates[-1]
                    break
            
        except Exception as e:
            self.logger.warning(f"Error extracting status from table row: {str(e)}")
        
        return status_info
    
    def _extract_oj_reference_from_url(self, url: str) -> str:
        """URLからOJ参照番号を生成"""
        try:
            # URLパターンからOJ情報を抽出
            if 'OJ.L_.2022.289' in url:
                return "OJ L 289, 10.11.2022"
            elif 'OJ.L_.2019.206' in url:
                return "OJ L 206, 6.8.2019"
            elif '2023/2723' in url:
                return "OJ L, 2023/2723, 13.12.2023"
            elif '2024/1198' in url:
                return "Amendment 19.4.2024"
            elif '2024/2764' in url:
                return "Amendment 30.10.2024"
            elif '2025/138' in url:
                return "Amendment 28.1.2025"
            elif '2025/893' in url:
                return "Amendment 14.5.2025"
            elif '202302392' in url:
                return "Amendment 3.10.2023"
            elif '2023/2669' in url:
                return "Amendment 27.11.2023"
            else:
                # 汎用的なパターン
                year_match = re.search(r'(\d{4})', url)
                if year_match:
                    return f"OJ {year_match.group(1)}"
                return "OJ Reference"
        except Exception:
            return ""
    
    def _sort_standards_by_number(self, standards: List[Standard]) -> List[Standard]:
        """規格番号でソート"""
        def extract_sort_key(standard: Standard) -> tuple:
            """規格番号から数値的なソートキーを抽出"""
            try:
                # 規格番号を正規化
                number = standard.number.upper().strip()
                
                # "EN 301 489-17" のような形式を解析
                import re
                
                # ENから始まる規格の処理
                if number.startswith('EN '):
                    # "EN 301 489-17" -> ["EN", "301", "489-17"]
                    parts = number.split()
                    if len(parts) >= 3:
                        try:
                            # EN, 第1数字, 第2数字, パート番号
                            main_num = int(parts[1])  # 301
                            second_part = parts[2]    # "489-17"
                            
                            # 第2数字とパート番号を分離
                            if '-' in second_part:
                                second_num_str, part_str = second_part.split('-', 1)
                                second_num = int(second_num_str)  # 489
                                
                                # パート番号の処理（複数のハイフンがある場合）
                                part_parts = part_str.split('-')
                                part_nums = []
                                for part in part_parts:
                                    try:
                                        part_nums.append(int(part))
                                    except ValueError:
                                        part_nums.append(999999)  # 数字でない場合は最後に
                                
                                return ('EN', main_num, second_num, tuple(part_nums))
                            else:
                                # パート番号がない場合
                                second_num = int(second_part)
                                return ('EN', main_num, second_num, (0,))
                        except ValueError:
                            pass
                
                # ETSI EN規格の処理
                elif number.startswith('ETSI EN '):
                    # "ETSI EN 301 489-17" -> ENと同じ処理
                    en_part = number[5:]  # "ETSI "を除去
                    temp_standard = Standard(
                        number=f"EN {en_part}",
                        version=standard.version,
                        directive=standard.directive,
                        title=standard.title,
                        status=standard.status,
                        publication_date=standard.publication_date,
                        amendment_date=standard.amendment_date
                    )
                    key = extract_sort_key(temp_standard)
                    return ('ETSI',) + key[1:]  # 'EN'を'ETSI'に変更
                
                # その他の規格（ISO、IEC等）
                else:
                    # 数字を抽出してソート
                    numbers = re.findall(r'\d+', number)
                    if numbers:
                        return (number.split()[0], *[int(n) for n in numbers])
                    else:
                        return (number, 999999)
                        
            except Exception:
                # エラーの場合は文字列ソート
                return (standard.number, 999999)
            
            # デフォルトのソートキー
            return (standard.number, 999999)
        
        try:
            # ソートキーでソート
            sorted_standards = sorted(standards, key=extract_sort_key)
            return sorted_standards
            
        except Exception as e:
            self.logger.warning(f"Error sorting standards: {str(e)}, using default sort")
            # エラーの場合は文字列ソート
            return sorted(standards, key=lambda x: x.number)