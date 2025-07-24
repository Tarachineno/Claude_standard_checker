#!/usr/bin/env python3
"""
Test script to verify RE directive fetches from all OJ sources
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from oj_checker import OJChecker

def test_re_sources():
    """Test that RE directive fetches from all OJ sources"""
    print("Testing RE directive OJ sources...")
    
    checker = OJChecker()
    
    # Clear cache first
    import os
    import glob
    cache_files = glob.glob('cache/*.json')
    for f in cache_files:
        os.remove(f)
    
    print("\n1. Testing EUR-Lex main document...")
    try:
        main_standards = checker._parse_eur_lex_page(
            'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv%3AOJ.L_.2022.289.01.0007.01.ENG&toc=OJ%3AL%3A2022%3A289%3ATOC', 
            'RE'
        )
        print(f"   ✓ Main document: {len(main_standards)} standards")
        
        # Show some examples
        for i, std in enumerate(main_standards[:5]):
            print(f"   - {std.number} {std.version}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n2. Testing EUR-Lex amendments...")
    amendments = [
        'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202302392',
        'https://eur-lex.europa.eu/eli/dec_impl/2023/2669/oj',
        'https://eur-lex.europa.eu/eli/dec_impl/2025/138/oj',
        'https://eur-lex.europa.eu/eli/dec_impl/2025/893/oj/eng'
    ]
    
    for i, url in enumerate(amendments):
        try:
            amendment_standards = checker._parse_eur_lex_page(url, 'RE')
            print(f"   ✓ Amendment {i+1}: {len(amendment_standards)} standards")
            
            # Show some examples if any
            if amendment_standards:
                for j, std in enumerate(amendment_standards[:3]):
                    print(f"     - {std.number} {std.version}")
                    
        except Exception as e:
            print(f"   ✗ Amendment {i+1} error: {e}")
    
    print("\n3. Testing complete RE directive fetch...")
    try:
        result = checker.fetch_standards('RE')
        if result.success:
            print(f"   ✓ Total standards fetched: {len(result.data)}")
            
            # Count by source
            versioned_count = sum(1 for std in result.data if std.version)
            unversioned_count = len(result.data) - versioned_count
            
            print(f"   - With version: {versioned_count}")
            print(f"   - Without version: {unversioned_count}")
            
            # Show some examples
            print("\n   Examples:")
            for std in result.data[:10]:
                version_str = f" {std.version}" if std.version else ""
                print(f"   - {std.number}{version_str}")
                
        else:
            print(f"   ✗ Failed: {result.error_message}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\nTest completed!")

if __name__ == "__main__":
    test_re_sources()