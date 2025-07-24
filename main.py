"""
Main Application - EU Harmonized Standards Checker System
"""

import sys
import os

from oj_checker import OJChecker
from etsi_searcher import ETSIPortalSearcher
from iso17025_extractor import ISO17025ScopeExtractor
from utils import setup_logging, enable_debug_mode
from config import DIRECTIVE_INFO, get_available_directives


class HarmonizedStandardsChecker:
    """Main Application Class"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.oj_checker = OJChecker()
        self.etsi_searcher = ETSIPortalSearcher()
        self.iso17025_extractor = ISO17025ScopeExtractor()
        # self.comparator = StandardComparator()  # Removed for package distribution
        
        self.logger.info("Harmonized Standards Checker initialized")
    
    def run_full_check(self, directive: str = None) -> None:
        """完全なチェックを実行"""
        try:
            print("=== EU Harmonized Standards Checker ===\\n")
            
            if directive:
                directives = [directive]
            else:
                directives = list(DIRECTIVE_INFO.keys())
            
            for dir_code in directives:
                self._process_directive(dir_code)
                
        except Exception as e:
            self.logger.error(f"Error in full check: {str(e)}")
            print(f"Error: {str(e)}")
    
    def _process_directive(self, directive: str) -> None:
        """単一Directiveの処理"""
        try:
            print(f"=== {DIRECTIVE_INFO[directive]['name']} ({directive}) ===")
            
            # 規格を取得
            result = self.oj_checker.fetch_standards(directive)
            
            if result.success:
                standards = result.data
                print(f"Found {len(standards)} standards:")
                print(self.oj_checker.format_standards_display(standards))
                
                # ETSI検索URLの生成
                print(f"\\n=== ETSI Portal Search URLs ===")
                etsi_urls = self.etsi_searcher.get_search_urls(
                    [std.number for std in standards[:5]]  # 最初の5件のみ
                )
                
                for std_number, url in etsi_urls.items():
                    print(f"{std_number}: {url}")
                
            else:
                print(f"Failed to fetch standards: {result.error_message}")
            
            print("\\n" + "="*60 + "\\n")
            
        except Exception as e:
            self.logger.error(f"Error processing directive {directive}: {str(e)}")
            print(f"Error processing {directive}: {str(e)}")
    
    def interactive_mode(self) -> None:
        """対話式モード"""
        print("=== Interactive Mode ===")
        print("Choose an option:")
        print("  1 - Fetch OJ standards for a directive")
        print("  2 - Search ETSI portal for a standard")
        print("  3 - Extract ISO17025 certificate")
        print("  q - Quit")
        print()
        
        while True:
            try:
                choice = input("Enter command: ").strip()
                
                if choice.lower() in ['q', 'quit', 'exit']:
                    break
                
                if choice == '1':
                    self._interactive_oj_fetch()
                elif choice == '2':
                    self._interactive_etsi_search()
                elif choice == '3':
                    self._interactive_iso_extract()
                else:
                    print("Invalid command. Please try again.")
                
                print()
                
            except KeyboardInterrupt:
                print("\nExiting interactive mode.")
                break
            except Exception as e:
                print(f"Error: {str(e)}")
                continue
    
    def _interactive_oj_fetch(self) -> None:
        """対話式OJ規格取得"""
        available = get_available_directives()
        print(f"\nAvailable directives: {', '.join(available)}")
        directive = input("Enter directive code: ").strip().upper()
        
        if directive not in DIRECTIVE_INFO:
            print("Invalid directive code.")
            return
        
        result = self.oj_checker.fetch_standards(directive)
        
        if result.success:
            standards = result.data
            print(f"\nFound {len(standards)} standards:")
            print(self.oj_checker.format_standards_display(standards))
        else:
            print(f"Failed to fetch standards: {result.error_message}")
    
    def _interactive_etsi_search(self) -> None:
        """対話式ETSI検索"""
        query = input("\nEnter standard number to search: ").strip()
        
        if not query:
            print("Search query cannot be empty.")
            return
        
        print(f"Searching ETSI portal for: {query}")
        result = self.etsi_searcher.search_and_open(query)
        
        if result.success:
            print(f"Search URL: {result.data}")
            print("Opening in browser...")
        else:
            print(f"Search failed: {result.error_message}")
    
    def _interactive_iso_extract(self) -> None:
        """対話式ISO17025抽出"""
        pdf_path = input("\nEnter ISO17025 PDF path: ").strip()
        
        if not os.path.exists(pdf_path):
            print("File not found.")
            return
        
        print("Extracting standards from PDF...")
        result = self.iso17025_extractor.extract_from_pdf(pdf_path)
        
        if result.success:
            scope = result.data
            print(f"\nCertificate: {scope.certificate_info.certificate_number}")
            print(f"Organization: {scope.certificate_info.organization}")
            print(f"Valid until: {scope.certificate_info.valid_until}")
            print(f"Total standards found: {len(scope.test_standards)}\n")
            
            # 規格をカテゴリ別に表示
            categorized = self.iso17025_extractor.get_standards_by_category(scope)
            for category, standards in categorized.items():
                print(f"\n{category}: {len(standards)} standards")
                for std in standards:
                    print(f"  - {std.standard_number}")
        else:
            print(f"Extraction failed: {result.error_message}")
    
    def search_standards(self, query: str) -> None:
        """規格検索"""
        try:
            print(f"\n=== Searching for: {query} ===")
            
            # 全DirectiveのOJ規格を検索
            found_standards = []
            
            for directive in DIRECTIVE_INFO.keys():
                result = self.oj_checker.fetch_standards(directive)
                if result.success:
                    for std in result.data:
                        if (query.lower() in std.number.lower() or 
                            query.lower() in std.title.lower()):
                            found_standards.append((directive, std))
            
            if found_standards:
                print(f"Found {len(found_standards)} matching standards:\n")
                for directive, std in found_standards:
                    version = f" {std.version}" if std.version else ""
                    title = f" - {std.title}" if std.title else ""
                    print(f"[{directive}] {std.number}{version}{title}")
                    
                    # ETSI検索URL生成
                    etsi_result = self.etsi_searcher.get_search_url(std.number)
                    if etsi_result.success:
                        print(f"  ETSI: {etsi_result.data}")
                    print()
            else:
                print("No matching standards found.")
                
        except Exception as e:
            self.logger.error(f"Error in search: {str(e)}")
            print(f"Search error: {str(e)}")

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python main.py interactive")
        print("  python main.py check [directive] [--debug]")
        print("  python main.py compare <pdf_path> [directive] [--debug]  # Not available in package version")
        print("  python main.py search <query> [--debug]")
        print("  python main.py debug <directive>  # デバッグモードで実行")
        sys.exit(1)  # 例外で止まるように戻しました
    
    # デバッグフラグをチェック
    debug_mode = '--debug' in sys.argv
    if debug_mode:
        enable_debug_mode()
        sys.argv.remove('--debug')
        print("Debug mode enabled. Check debug_standards.log for detailed logs.")
    
    app = HarmonizedStandardsChecker()
    command = sys.argv[1].lower()
    
    if command == 'interactive':
        app.interactive_mode()
    
    elif command == 'check':
        directive = sys.argv[2] if len(sys.argv) > 2 else None
        app.run_full_check(directive)
    
    elif command == 'compare':
        print("Compare feature is not available in this package version")
        print("Available commands: interactive, check, search, debug")
    
    elif command == 'search':
        if len(sys.argv) < 3:
            print("Error: Search query required")
            sys.exit(1)
        
        query = sys.argv[2]
        app.search_standards(query)
    
    elif command == 'debug':
        # 専用デバッグモード
        enable_debug_mode()
        directive = sys.argv[2] if len(sys.argv) > 2 else 'RED'
        print(f"Running debug mode for {directive} directive...")
        print("Detailed logs will be saved to debug_standards.log")
        app.run_full_check(directive)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()