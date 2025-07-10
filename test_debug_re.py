#!/usr/bin/env python3
"""
Debug test script for RE directive fetching
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils import enable_debug_mode, debug_log
from oj_checker import OJChecker

def test_re_debug():
    """RE指令のデバッグテスト"""
    print("=== RE Directive Debug Test ===")
    print("Enabling debug mode...")
    
    # デバッグモードを有効化
    enable_debug_mode()
    
    debug_log("Debug test started", "general")
    
    # OJCheckerを初期化
    checker = OJChecker()
    
    # キャッシュをクリア
    import glob
    cache_files = glob.glob('cache/*.json')
    for f in cache_files:
        os.remove(f)
    debug_log(f"Cleared {len(cache_files)} cache files", "general")
    
    print("\nStarting RE directive fetch with detailed logging...")
    print("Check debug_standards.log for detailed information")
    
    # RE指令の規格を取得
    result = checker.fetch_standards('RE')
    
    if result.success:
        print(f"\n✓ Successfully fetched {len(result.data)} standards")
        print("\nFirst 10 standards:")
        for i, std in enumerate(result.data[:10]):
            version_str = f" {std.version}" if std.version else ""
            oj_str = f" ({std.oj_reference})" if std.oj_reference else ""
            print(f"  {i+1:2d}. {std.number}{version_str}{oj_str}")
    else:
        print(f"\n✗ Failed: {result.error_message}")
    
    debug_log("Debug test completed", "general")
    print(f"\nDebug log saved to: debug_standards.log")

if __name__ == "__main__":
    test_re_debug()