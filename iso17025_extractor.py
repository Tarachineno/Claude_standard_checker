
"""
ISO17025 Scope Extractor Module - ISO17025 Certificate Scope Extraction
"""

import re
import logging
from typing import List, Dict, Optional
from datetime import datetime
import pdfplumber
import PyPDF2

from config import STANDARD_PATTERNS
from data_models import TestStandard, CertificateInfo, AccreditationScope, ProcessingResult
from utils import (
    setup_logging, normalize_standard_number, extract_version_from_standard,
    parse_date_string, create_cache_key, save_to_cache, load_from_cache,
    get_file_hash
)




class ISO17025ScopeExtractor:
    """ISO17025 Certificate Scope Extractor"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.supported_formats = ['pdf']
        self.standard_patterns = STANDARD_PATTERNS
        
    def extract_from_pdf(self, pdf_path: str) -> ProcessingResult:
        """PDFファイルから認証スコープを抽出"""
        try:
            self.logger.info(f"Extracting scope from PDF: {pdf_path}")
            # キャッシュキーを生成（ファイルハッシュベース）
            file_hash = get_file_hash(pdf_path)
            cache_key = create_cache_key("iso17025_scope", file_hash)
            # キャッシュから確認
            cached_data = load_from_cache(cache_key)
            if cached_data:
                self.logger.info("Using cached extraction result")
                return ProcessingResult(success=True, data=cached_data)
            # まず通常のテキスト抽出を試みる
            text = self._extract_text_from_pdf(pdf_path)
            if not text or not text.strip():
                print("PDFからテキスト抽出できません。OCRを実行します...")
                try:
                    from pdf2image import convert_from_path
                    import pytesseract
                    images = convert_from_path(pdf_path)
                    ocr_text = ""
                    total_pages = len(images)
                    for idx, img in enumerate(images, 1):
                        print(f"OCR処理中: ページ {idx}/{total_pages} ...")
                        page_text = pytesseract.image_to_string(img, lang='jpn+eng')
                        ocr_text += page_text
                    print("OCR処理完了")
                    text = ocr_text
                except Exception as e:
                    import traceback
                    print(f"OCR処理中にエラー: {e}")
                    traceback.print_exc()
                    return self._error_result(f"OCR failed: {e}")
            # 以降は既存のテキストパース処理
            test_standards = self._parse_scope_text(text)
            cert_info = self._extract_certificate_info(text)
            from datetime import datetime
            scope = AccreditationScope(
                certificate_info=cert_info,
                test_standards=test_standards,
                extraction_date=datetime.now().isoformat(),
                pdf_source=pdf_path
            )
            return ProcessingResult(success=True, data=scope)
        except Exception as e:
            self.logger.error(f"Error extracting from PDF {pdf_path}: {str(e)}")
            return ProcessingResult(
                success=False,
                error_message=f"Failed to extract scope: {str(e)}"
            )
    
    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """PDFからテキストを抽出"""
        text = ""
        
        # まずpdfplumberを試行
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\\n"
                        
            if text.strip():
                return text
                
        except Exception as e:
            self.logger.warning(f"pdfplumber failed: {str(e)}, trying PyPDF2")
        
        # PyPDF2を試行
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\\n"
                        
        except Exception as e:
            self.logger.error(f"PyPDF2 also failed: {str(e)}")
        
        return text
    
    def _extract_certificate_info(self, text: str) -> CertificateInfo:
        """証明書基本情報を抽出"""
        cert_info = CertificateInfo(
            certificate_number="",
            valid_until="",
            organization="",
            accreditation_body="",
            revision_date=""
        )
        
        try:
            # 証明書番号
            cert_patterns = [
                r'Certificate\s+Number:?\s*([\w\d\.\-]+)',
                r'Cert\.?\s+No\.?:?\s*([\w\d\.\-]+)',
                r'A2LA\s+Cert\.?\s+No\.?\s*([\w\d\.\-]+)',
                r'JAB\s+Cert\.?\s+No\.?\s*([\w\d\.\-]+)',
                r'Certificate\s+Number\s+([\w\d\.\-]+)',
                r'\(A2LA\s+Cert\.\s+No\.\s+([\w\d\.\-]+)\)',
                r'Certificate\s+Number:\s*([\w\d\.\-]+)'
            ]
            
            for pattern in cert_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    cert_info.certificate_number = match.group(1)
                    break
            
            # 有効期限
            validity_patterns = [
                r'Valid\s+(?:To|Until):?\s*([\w\s,]+\d{4})',
                r'Valid\s+to\s+([\w\s,]+\d{4})',
                r'Expires?:?\s*([\w\s,]+\d{4})',
                r'Valid\s+To:\s*([\w\s,]+\d{4})',
                r'Valid\s+To:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})'
            ]
            
            for pattern in validity_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    cert_info.valid_until = match.group(1).strip()
                    break
            
            # 組織名
            org_patterns = [
                r'(SGS\s+JAPAN\s+INC\.?)',
                r'([A-Z][A-Z\s&\.,]+(?:INC|LTD|LLC|CO|CORP|COMPANY|LABORATORY|LAB))\.?',
                r'SCOPE\s+OF\s+ACCREDITATION.*?\n([A-Z][A-Z\s&\.,]+)\n',
                r'([A-Z][A-Z\s&\.,]{10,})'
            ]
            
            for pattern in org_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    org_name = match.group(1).strip()
                    if len(org_name) > 5:  # 短すぎる名前は除外
                        cert_info.organization = org_name
                        break
            
            # 認証機関
            if 'A2LA' in text:
                cert_info.accreditation_body = 'A2LA'
            elif 'JAB' in text:
                cert_info.accreditation_body = 'JAB'
            elif 'ILAC' in text:
                cert_info.accreditation_body = 'ILAC'
            
            # 改訂日
            revision_patterns = [
                r'Revised\s+([\d/\-]+)',
                r'Revision\s+Date:?\s*([\d/\-]+)',
                r'Last\s+Updated:?\s*([\d/\-]+)'
            ]
            
            for pattern in revision_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    cert_info.revision_date = match.group(1)
                    break
            
        except Exception as e:
            self.logger.warning(f"Error extracting certificate info: {str(e)}")
        
        return cert_info
    
    def _parse_scope_text(self, text: str) -> List[TestStandard]:
        """テキストから規格情報を解析"""
        standards = []
        
        try:
            # 各パターンで規格を検索
            for category, pattern in self.standard_patterns.items():
                matches = re.findall(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    # 規格番号とバージョンを分離
                    number, version = extract_version_from_standard(match)
                    
                    if number:
                        # カテゴリを判定
                        test_category = self._determine_category(match, text)
                        
                        # 説明を抽出
                        description = self._extract_description(match, text)
                        
                        standard = TestStandard(
                            standard_number=number,
                            version=version,
                            category=test_category,
                            description=description,
                            source="ISO17025_Certificate"
                        )
                        
                        standards.append(standard)
            
            # 重複除去
            unique_standards = self._deduplicate_standards(standards)
            
            return unique_standards
            
        except Exception as e:
            self.logger.error(f"Error parsing scope text: {str(e)}")
            return []
    
    def _determine_category(self, standard_match: str, full_text: str) -> str:
        """規格のカテゴリを判定"""
        # 規格番号の周辺テキストを分析してカテゴリを判定
        try:
            # 規格番号の前後のテキストを取得
            pattern = re.escape(standard_match)
            match = re.search(f'.{{0,100}}{pattern}.{{0,100}}', full_text, re.IGNORECASE)
            
            if match:
                context = match.group().lower()
                
                # カテゴリ判定ルール
                if any(word in context for word in ['radio', 'wireless', 'rf', 'etsi']):
                    return "European Radio"
                elif any(word in context for word in ['immunity', 'esd', 'surge', 'burst']):
                    return "Immunity"
                elif any(word in context for word in ['emission', 'conducted', 'radiated']):
                    return "Emissions"
                elif any(word in context for word in ['harmonic', 'flicker', 'voltage']):
                    return "Power Quality"
                elif any(word in context for word in ['safety', 'medical', 'laser']):
                    return "Safety"
                elif any(word in context for word in ['automotive', 'vehicle', 'iso 7637']):
                    return "Automotive"
                elif any(word in context for word in ['generic', 'industrial', 'residential']):
                    return "Generic Standards"
                elif any(word in context for word in ['information', 'technology', 'it']):
                    return "Information Technology"
                elif any(word in context for word in ['fcc', 'part 15', 'cfr']):
                    return "FCC Standards"
                elif any(word in context for word in ['canada', 'rss', 'ices']):
                    return "Canada Radio"
                elif any(word in context for word in ['australia', 'new zealand', 'as/nzs']):
                    return "Australia/New Zealand"
                elif any(word in context for word in ['korea', 'korean', 'ks c']):
                    return "Korean Standards"
                elif any(word in context for word in ['semiconductor', 'semi']):
                    return "Semiconductor"
        
        except Exception:
            pass
        
        # デフォルトカテゴリ
        if standard_match.startswith('EN'):
            return "European Standards"
        elif standard_match.startswith('IEC'):
            return "IEC Standards"
        elif standard_match.startswith('ISO'):
            return "ISO Standards"
        elif standard_match.startswith('FCC') or 'CFR' in standard_match:
            return "FCC Standards"
        elif standard_match.startswith('ANSI'):
            return "ANSI Standards"
        
        return "Other"
    
    def _extract_description(self, standard_match: str, full_text: str) -> str:
        """規格の説明を抽出"""
        try:
            # 規格番号の後のテキストを取得
            pattern = re.escape(standard_match) + r'[^\\n]*'
            match = re.search(pattern, full_text, re.IGNORECASE)
            
            if match:
                line = match.group()
                # 規格番号以降のテキストを取得
                description = line[len(standard_match):].strip()
                
                # 不要な文字を除去
                description = re.sub(r'^[\\s;,:\\-]+', '', description)
                
                # 長すぎる場合は切り詰め
                if len(description) > 100:
                    description = description[:100] + "..."
                
                return description
            
        except Exception:
            pass
        
        return ""
    
    def _deduplicate_standards(self, standards: List[TestStandard]) -> List[TestStandard]:
        """重複する規格を除去"""
        seen = set()
        unique_standards = []
        
        for standard in standards:
            # 規格番号で重複チェック
            key = standard.standard_number
            if key not in seen:
                seen.add(key)
                unique_standards.append(standard)
        
        return unique_standards
    
    def validate_certificate(self, cert_info: CertificateInfo) -> bool:
        """証明書の有効性を確認"""
        try:
            # 基本情報の存在チェック
            if not cert_info.certificate_number:
                return False
            
            # 有効期限チェック（簡易版）
            if cert_info.valid_until:
                # 実際の実装では日付解析を行う
                return True
            
            return True
            
        except Exception:
            return False
    
    def get_standards_by_category(self, scope: AccreditationScope) -> Dict[str, List[TestStandard]]:
        """カテゴリ別に規格を分類"""
        categorized = {}
        
        for standard in scope.test_standards:
            category = standard.category
            if category not in categorized:
                categorized[category] = []
            categorized[category].append(standard)
        
        return categorized
    
    def format_extraction_result(self, scope: AccreditationScope) -> str:
        """抽出結果をフォーマット"""
        result = []
        
        # 証明書情報
        cert_info = scope.certificate_info
        result.append("=== ISO17025 Certificate Information ===")
        result.append(f"Certificate Number: {cert_info.certificate_number}")
        result.append(f"Organization: {cert_info.organization}")
        result.append(f"Accreditation Body: {cert_info.accreditation_body}")
        result.append(f"Valid Until: {cert_info.valid_until}")
        result.append(f"Revision Date: {cert_info.revision_date}")
        result.append("")
        
        # 規格情報
        result.append("=== Test Standards ===")
        
        categorized = self.get_standards_by_category(scope)
        
        for category, standards in categorized.items():
            result.append(f"\n{category} ({len(standards)} standards):")
            for standard in standards:
                version_str = f" {standard.version}" if standard.version else ""
                desc_str = f" - {standard.description}" if standard.description else ""
                result.append(f"  - {standard.standard_number}{version_str}{desc_str}")
        result.append(f"\nTotal Standards: {len(scope.test_standards)}")
        result.append(f"Extraction Date: {scope.extraction_date}")
        return "\n".join(result)
    
    def extract_from_multiple_pdfs(self, pdf_paths: List[str]) -> ProcessingResult:
        """複数のPDFから一括抽出"""
        all_scopes = []
        errors = []
        
        for pdf_path in pdf_paths:
            try:
                result = self.extract_from_pdf(pdf_path)
                if result.success:
                    all_scopes.append(result.data)
                else:
                    errors.append(f"{pdf_path}: {result.error_message}")
            except Exception as e:
                errors.append(f"{pdf_path}: {str(e)}")
        
        if all_scopes:
            return ProcessingResult(
                success=True,
                data=all_scopes,
                warnings=errors
            )
        else:
            return ProcessingResult(
                success=False,
                error_message="No valid scopes extracted",
                warnings=errors
            )


    def compare_standards(self, iso_standards: List[TestStandard], oj_standards: List[TestStandard]) -> Dict[str, List[str]]:
        """ISO17025規格とOJ規格を比較し、完全一致・バージョン違い・未一致を分類"""
        matches = []
        version_mismatches = []
        unmatched = []
        
        oj_numbers = set(std.standard_number for std in oj_standards)
        oj_versions_dict = {}
        for std in oj_standards:
            oj_versions_dict.setdefault(std.standard_number, set()).add(std.version)
        
        for iso_std in iso_standards:
            if iso_std.standard_number in oj_numbers:
                oj_versions = oj_versions_dict[iso_std.standard_number]
                if iso_std.version in oj_versions or not iso_std.version:
                    matches.append(f"✓ {iso_std.standard_number}{' ' + iso_std.version if iso_std.version else ''}")
                else:
                    version_mismatches.append(f"△ {iso_std.standard_number} (ISO: {iso_std.version}, OJ: {', '.join([v for v in oj_versions if v])})")
            else:
                unmatched.append(f"× {iso_std.standard_number}{' ' + iso_std.version if iso_std.version else ''}")
        
        return {
            "matches": matches,
            "version_mismatches": version_mismatches,
            "unmatched": unmatched
        }