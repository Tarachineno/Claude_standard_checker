"""
ETSI Portal Searcher Module - ETSI Portal Standards Search
"""

import webbrowser
import logging
from typing import List, Dict, Optional
from datetime import datetime
from urllib.parse import urlencode

from config import ETSI_PORTAL
from data_models import SearchResult, ProcessingResult
from utils import (
    setup_logging, create_etsi_search_url, validate_url,
    normalize_standard_number, create_cache_key, save_to_cache,
    load_from_cache
)


class ETSIPortalSearcher:
    """ETSI Portal Standards Searcher"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.base_url = ETSI_PORTAL['base_url']
        self.search_params = ETSI_PORTAL['search_params']
        
    def search_standard(self, standard_number: str) -> SearchResult:
        """単一規格の検索URLを生成"""
        try:
            self.logger.info(f"Generating search URL for standard: {standard_number}")
            
            # 規格番号を正規化
            normalized_number = normalize_standard_number(standard_number)
            
            # 検索URLを生成
            search_url = self._generate_search_url(normalized_number)
            
            # URLの有効性を確認
            if not validate_url(search_url):
                return SearchResult(
                    standard_number=standard_number,
                    search_url="",
                    timestamp=datetime.now().isoformat(),
                    success=False,
                    error_message="Invalid search URL generated"
                )
            
            self.logger.info(f"Search URL generated successfully: {search_url}")
            
            return SearchResult(
                standard_number=standard_number,
                search_url=search_url,
                timestamp=datetime.now().isoformat(),
                success=True
            )
            
        except Exception as e:
            self.logger.error(f"Error generating search URL for {standard_number}: {str(e)}")
            return SearchResult(
                standard_number=standard_number,
                search_url="",
                timestamp=datetime.now().isoformat(),
                success=False,
                error_message=str(e)
            )
    
    def _generate_search_url(self, standard_number: str) -> str:
        """ETSI Portal検索URLを生成"""
        # "EN 301 489-17" → "301 489-17"
        etsi_number = standard_number.replace("EN ", "")
        etsi_number = etsi_number.replace("ETSI ", "")
        etsi_number = etsi_number.replace("ETSI EN ", "")
        
        # 余分なスペースを除去
        etsi_number = etsi_number.strip()
        
        # 検索パラメータを設定
        params = self.search_params.copy()
        params['qETSI_NUMBER'] = etsi_number
        
        # URLを構築
        search_url = f"{self.base_url}?{urlencode(params)}"
        
        return search_url
    
    def open_search_result(self, search_url: str) -> bool:
        """ブラウザで検索結果を開く"""
        try:
            self.logger.info(f"Opening search result in browser: {search_url}")
            webbrowser.open(search_url)
            return True
            
        except Exception as e:
            self.logger.error(f"Error opening browser: {str(e)}")
            return False
    
    def search_and_open(self, standard_number: str) -> SearchResult:
        """規格を検索してブラウザで開く"""
        search_result = self.search_standard(standard_number)
        
        if search_result.success:
            if self.open_search_result(search_result.search_url):
                self.logger.info(f"Successfully opened search result for {standard_number}")
            else:
                search_result.error_message = "Failed to open browser"
                search_result.success = False
        
        return search_result
    
    def batch_search(self, standard_numbers: List[str]) -> Dict[str, SearchResult]:
        """複数規格の一括検索"""
        results = {}
        
        for standard_number in standard_numbers:
            try:
                result = self.search_standard(standard_number)
                results[standard_number] = result
                
            except Exception as e:
                self.logger.error(f"Error in batch search for {standard_number}: {str(e)}")
                results[standard_number] = SearchResult(
                    standard_number=standard_number,
                    search_url="",
                    timestamp=datetime.now().isoformat(),
                    success=False,
                    error_message=str(e)
                )
        
        return results
    
    def get_search_urls(self, standard_numbers: List[str]) -> Dict[str, str]:
        """複数規格の検索URLを取得"""
        urls = {}
        
        for standard_number in standard_numbers:
            result = self.search_standard(standard_number)
            if result.success:
                urls[standard_number] = result.search_url
            else:
                self.logger.warning(f"Failed to generate URL for {standard_number}: {result.error_message}")
        
        return urls
    
    def validate_standard_format(self, standard_number: str) -> bool:
        """規格番号の形式をチェック"""
        # ETSIで検索可能な規格番号パターン
        etsi_patterns = [
            r'^\d+\s+\d+(?:-\d+)*$',  # 301 489-17
            r'^EN\s+\d+\s+\d+(?:-\d+)*$',  # EN 301 489-17
            r'^ETSI\s+EN\s+\d+\s+\d+(?:-\d+)*$',  # ETSI EN 301 489-17
        ]
        
        import re
        normalized = normalize_standard_number(standard_number)
        
        for pattern in etsi_patterns:
            if re.match(pattern, normalized):
                return True
        
        return False
    
    def extract_etsi_number(self, standard_number: str) -> str:
        """規格番号からETSI番号を抽出"""
        # "EN 301 489-17" → "301 489-17"
        etsi_number = standard_number.replace("EN ", "")
        etsi_number = etsi_number.replace("ETSI ", "")
        etsi_number = etsi_number.replace("ETSI EN ", "")
        
        return etsi_number.strip()
    
    def format_search_results(self, results: Dict[str, SearchResult]) -> str:
        """検索結果をフォーマット"""
        if not results:
            return "No search results."
        
        formatted = []
        formatted.append("=== ETSI Portal Search Results ===\\n")
        
        for standard_number, result in results.items():
            if result.success:
                formatted.append(f"✓ {standard_number}")
                formatted.append(f"  URL: {result.search_url}")
            else:
                formatted.append(f"✗ {standard_number}")
                formatted.append(f"  Error: {result.error_message}")
            formatted.append("")
        
        return "\\n".join(formatted)
    
    def create_search_summary(self, results: Dict[str, SearchResult]) -> Dict[str, int]:
        """検索結果のサマリーを作成"""
        summary = {
            'total': len(results),
            'successful': 0,
            'failed': 0
        }
        
        for result in results.values():
            if result.success:
                summary['successful'] += 1
            else:
                summary['failed'] += 1
        
        return summary
    
    def get_alternative_search_methods(self, standard_number: str) -> List[str]:
        """代替検索方法の提案"""
        alternatives = []
        
        # 基本的な番号抽出
        base_number = self.extract_etsi_number(standard_number)
        
        # 異なる検索パターンを提案
        variations = [
            base_number,
            f"EN {base_number}",
            f"ETSI EN {base_number}",
            base_number.replace("-", " "),
            base_number.replace(" ", "-")
        ]
        
        for variation in variations:
            if variation != standard_number:
                search_result = self.search_standard(variation)
                if search_result.success:
                    alternatives.append(f"{variation}: {search_result.search_url}")
        
        return alternatives
    
    def interactive_search(self):
        """対話的な検索モード"""
        print("=== ETSI Portal Interactive Search ===")
        print("Enter standard numbers to search (or 'quit' to exit):")
        print("Example: EN 301 489-17")
        print()
        
        while True:
            try:
                user_input = input("Standard number: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'q']:
                    break
                
                if not user_input:
                    continue
                
                # 検索実行
                result = self.search_and_open(user_input)
                
                if result.success:
                    print(f"✓ Search URL generated and opened: {result.search_url}")
                else:
                    print(f"✗ Search failed: {result.error_message}")
                    
                    # 代替案を提案
                    alternatives = self.get_alternative_search_methods(user_input)
                    if alternatives:
                        print("Alternative search options:")
                        for alt in alternatives:
                            print(f"  - {alt}")
                
                print()
                
            except KeyboardInterrupt:
                print("\\nExiting interactive search.")
                break
            except Exception as e:
                print(f"Error: {str(e)}")
                continue
    
    def bulk_search_from_file(self, file_path: str) -> ProcessingResult:
        """ファイルから規格リストを読み込んで一括検索"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                standard_numbers = [line.strip() for line in f if line.strip()]
            
            results = self.batch_search(standard_numbers)
            
            return ProcessingResult(
                success=True,
                data=results
            )
            
        except Exception as e:
            return ProcessingResult(
                success=False,
                error_message=f"Failed to process file: {str(e)}"
            )