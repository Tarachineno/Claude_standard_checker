"""
Main Application - EU Harmonized Standards Checker System
"""

import os
import sys
from typing import List, Dict
from datetime import datetime

from oj_checker import OJChecker
from etsi_searcher import ETSIPortalSearcher
from iso17025_extractor import ISO17025ScopeExtractor
from comparator import StandardComparator
from data_models import TestStandard, AccreditationScope, ComparisonResult
from utils import setup_logging, enable_debug_mode
from config import DIRECTIVE_INFO, get_available_directives


class HarmonizedStandardsChecker:
    """Main Application Class"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.oj_checker = OJChecker()
        self.etsi_searcher = ETSIPortalSearcher()
        self.iso17025_extractor = ISO17025ScopeExtractor()
        self.comparator = StandardComparator()
        
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
    
    def compare_with_iso17025(self, pdf_path: str, directive: str = None) -> None:
        """ISO17025証明書との比較"""
        try:
            print("=== ISO17025 Certificate Comparison ===\\n")
            
            # ISO17025証明書から規格を抽出
            print("Extracting standards from ISO17025 certificate...")
            iso_result = self.iso17025_extractor.extract_from_pdf(pdf_path)
            
            if not iso_result.success:
                print(f"Failed to extract from PDF: {iso_result.error_message}")
                return
            
            iso_scope = iso_result.data
            print(f"Certificate: {iso_scope.certificate_info.certificate_number}")
            print(f"Organization: {iso_scope.certificate_info.organization}")
            print(f"Valid until: {iso_scope.certificate_info.valid_until}")
            print(f"Extracted {len(iso_scope.test_standards)} standards\\n")
            
            # OJ規格を取得
            if directive:
                directives = [directive]
            else:
                directives = list(DIRECTIVE_INFO.keys())
            
            for dir_code in directives:
                self._compare_directive_with_iso(dir_code, iso_scope.test_standards)
                
        except Exception as e:
            self.logger.error(f"Error in ISO17025 comparison: {str(e)}")
            print(f"Error: {str(e)}")
    
    def _compare_directive_with_iso(self, directive: str, iso_standards: List[TestStandard]) -> None:
        """単一DirectiveとISO17025の比較"""
        try:
            print(f"=== Comparing with {DIRECTIVE_INFO[directive]['name']} ===")
            
            # OJ規格を取得
            oj_result = self.oj_checker.fetch_standards(directive)
            
            if not oj_result.success:
                print(f"Failed to fetch OJ standards: {oj_result.error_message}")
                return
            
            oj_standards = oj_result.data
            
            # 比較実行
            comparison = self.comparator.compare_standards(oj_standards, iso_standards)
            
            # 結果表示
            print(f"OJ Standards: {len(oj_standards)}")
            print(f"ISO17025 Standards: {len(iso_standards)}")
            print(f"Matched: {len(comparison.matched_standards)}")
            print(f"Coverage: {comparison.coverage_percentage:.1f}%\\n")
            
            # マッチした規格の表示
            if comparison.matched_standards:
                print("Matched Standards:")
                for oj_std, iso_std in comparison.matched_standards:
                    print(f"  ✓ {oj_std.number} ↔ {iso_std.standard_number}")
            
            print("\\n" + "="*50 + "\\n")
            
        except Exception as e:
            self.logger.error(f"Error comparing {directive} with ISO: {str(e)}")
            print(f"Error: {str(e)}")
    
    def interactive_mode(self) -> None:
        """対話式モード"""
        print("=== Interactive Mode ===")
        print("Commands:")
        print("  1 - Fetch OJ standards for a directive")
        print("  2 - Search ETSI portal for a standard")
        print("  3 - Extract ISO17025 certificate")
        print("  4 - Compare OJ with ISO17025")
        print("  5 - Full comparison report")
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
                elif choice == '4':
                    self._interactive_comparison()
                elif choice == '5':
                    self._interactive_full_report()
                else:
                    print("Invalid command. Please try again.")
                
                print()
                
            except KeyboardInterrupt:
                print("\\nExiting interactive mode.")
                break
            except Exception as e:
                print(f"Error: {str(e)}")
                continue
    
    def _interactive_oj_fetch(self) -> None:
        """対話式OJ規格取得"""
        available = get_available_directives()
        print(f"\\nAvailable directives: {', '.join(available)}")
        directive = input("Enter directive code: ").strip().upper()
        
        if directive not in DIRECTIVE_INFO:
            print("Invalid directive code.")
            return
        
        result = self.oj_checker.fetch_standards(directive)
        
        if result.success:
            standards = result.data
            print(f"\\nFound {len(standards)} standards:")
            print(self.oj_checker.format_standards_display(standards))
        else:
            print(f"Failed to fetch standards: {result.error_message}")
    
    def _interactive_etsi_search(self) -> None:
        """対話式ETSI検索"""
        standard = input("\\nEnter standard number (e.g., EN 301 489-17): ").strip()
        
        if not standard:
            print("Please enter a valid standard number.")
            return
        
        result = self.etsi_searcher.search_and_open(standard)
        
        if result.success:
            print(f"Search URL: {result.search_url}")
            print("Opening in browser...")
        else:
            print(f"Search failed: {result.error_message}")
    
    def _interactive_iso_extract(self) -> None:
        """対話式ISO17025抽出"""
        pdf_path = input("\\nEnter PDF file path: ").strip()
        
        if not os.path.exists(pdf_path):
            print("File not found.")
            return
        
        result = self.iso17025_extractor.extract_from_pdf(pdf_path)
        
        if result.success:
            scope = result.data
            print(f"\\nCertificate: {scope.certificate_info.certificate_number}")
            print(f"Organization: {scope.certificate_info.organization}")
            print(f"Valid until: {scope.certificate_info.valid_until}")
            print(f"Standards extracted: {len(scope.test_standards)}")
            
            # カテゴリ別表示
            categorized = self.iso17025_extractor.get_standards_by_category(scope)
            for category, standards in categorized.items():
                print(f"\n{category}: {len(standards)} standards")
                for std in standards:
                    print(f"  - {std.standard_number}")
        else:
            print(f"Extraction failed: {result.error_message}")
    
    def _interactive_comparison(self) -> None:
        """対話式比較"""
        pdf_path = input("\\nEnter ISO17025 PDF path: ").strip()
        directive = input("Enter directive code (RE/EMC/LVD, or blank for all): ").strip().upper()
        
        if not os.path.exists(pdf_path):
            print("File not found.")
            return
        
        if directive and directive not in DIRECTIVE_INFO:
            print("Invalid directive code.")
            return
        
        self.compare_with_iso17025(pdf_path, directive if directive else None)
    
    def _interactive_full_report(self) -> None:
        """対話式完全レポート"""
        pdf_path = input("\\nEnter ISO17025 PDF path: ").strip()
        
        if not os.path.exists(pdf_path):
            print("File not found.")
            return
        
        try:
            # ISO17025抽出
            iso_result = self.iso17025_extractor.extract_from_pdf(pdf_path)
            if not iso_result.success:
                print(f"Failed to extract ISO17025: {iso_result.error_message}")
                return
            
            iso_scope = iso_result.data
            
            # 全DirectiveのOJ規格を取得
            oj_standards = self.oj_checker.get_all_standards()
            
            # 一括比較
            comparison_results = self.comparator.batch_compare(
                oj_standards, iso_scope.test_standards
            )
            
            # 結果表示
            print("\\n=== Full Comparison Report ===")
            print(f"Certificate: {iso_scope.certificate_info.certificate_number}")
            print(f"Organization: {iso_scope.certificate_info.organization}")
            print(f"Total ISO17025 Standards: {len(iso_scope.test_standards)}\\n")
            
            for directive, comparison in comparison_results.items():
                print(f"{DIRECTIVE_INFO[directive]['name']} ({directive}):")
                print(f"  Coverage: {comparison.coverage_percentage:.1f}%")
                print(f"  Matched: {len(comparison.matched_standards)}")
                print(f"  OJ Only: {len(comparison.oj_only_standards)}")
                print()
            
            # 最適なDirectiveを特定
            best_directive = self.comparator.get_best_directive_match(
                iso_scope.test_standards, oj_standards
            )
            print(f"Best matching directive: {best_directive}")
            
            # 詳細レポートの保存
            save_report = input("\\nSave detailed report? (y/n): ").strip().lower()
            if save_report == 'y':
                self._save_detailed_report(comparison_results, iso_scope)
            
        except Exception as e:
            print(f"Error generating report: {str(e)}")
    
    def _save_detailed_report(self, comparison_results: Dict[str, ComparisonResult], 
                            iso_scope: AccreditationScope) -> None:
        """詳細レポートをファイルに保存"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"standards_comparison_report_{timestamp}.txt"
            
            with open(filename, 'w', encoding='utf-8') as f:
                f.write("EU HARMONIZED STANDARDS COMPARISON REPORT\\n")
                f.write("="*60 + "\\n")
                f.write(f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\\n")
                f.write(f"Certificate: {iso_scope.certificate_info.certificate_number}\\n")
                f.write(f"Organization: {iso_scope.certificate_info.organization}\\n")
                f.write(f"Valid Until: {iso_scope.certificate_info.valid_until}\\n\\n")
                
                for directive, comparison in comparison_results.items():
                    f.write(f"\\n{DIRECTIVE_INFO[directive]['name']} ({directive})\\n")
                    f.write("-" * 50 + "\\n")
                    f.write(self.comparator.generate_comparison_report(comparison))
                    f.write("\\n")
            
            print(f"Report saved to: {filename}")
            
        except Exception as e:
            print(f"Error saving report: {str(e)}")
    
    def search_standards(self, query: str) -> None:
        """規格検索"""
        try:
            print(f"\\n=== Searching for: {query} ===")
            
            # 全DirectiveのOJ規格を検索
            all_standards = self.oj_checker.get_all_standards()
            
            found_standards = []
            for directive, standards in all_standards.items():
                for std in standards:
                    if (query.lower() in std.number.lower() or 
                        query.lower() in std.title.lower()):
                        found_standards.append((directive, std))
            
            if found_standards:
                print(f"Found {len(found_standards)} matching standards:\\n")
                for directive, std in found_standards:
                    version = f" {std.version}" if std.version else ""
                    title = f" - {std.title}" if std.title else ""
                    print(f"[{directive}] {std.number}{version}{title}")
                    
                    # ETSI検索URL生成
                    etsi_result = self.etsi_searcher.search_standard(std.number)
                    if etsi_result.success:
                        print(f"  ETSI: {etsi_result.search_url}")
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
        print("  python main.py compare <pdf_path> [directive] [--debug]")
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
        if len(sys.argv) < 3:
            print("Error: PDF path required for compare command")
            sys.exit(1)
        
        pdf_path = sys.argv[2]
        directive = sys.argv[3] if len(sys.argv) > 3 else None
        app.compare_with_iso17025(pdf_path, directive)
    
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