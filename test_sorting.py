#!/usr/bin/env python3
"""
Test script to verify standards are properly sorted
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from oj_checker import OJChecker

def test_sorting():
    """Test that standards are properly sorted by number"""
    print("Testing standards sorting...")
    
    checker = OJChecker()
    
    # Test sorting functionality
    print("\n1. Testing RE directive sorting...")
    try:
        result = checker.fetch_standards('RE')
        if result.success:
            standards = result.data
            print(f"   Found {len(standards)} standards")
            
            # Show first 20 standards to verify sorting
            print("\n   First 20 standards (should be in numerical order):")
            for i, std in enumerate(standards[:20]):
                version_str = f" {std.version}" if std.version else ""
                print(f"   {i+1:2d}. {std.number}{version_str}")
            
            # Verify EN 300 series comes before EN 301 series
            en300_found = False
            en301_found = False
            
            for std in standards:
                if std.number.startswith('EN 300'):
                    en300_found = True
                elif std.number.startswith('EN 301') and en300_found:
                    en301_found = True
                    break
            
            if en300_found and en301_found:
                print("   ✓ Sorting verified: EN 300 series comes before EN 301 series")
            else:
                print("   ✗ Sorting issue detected")
            
            # Test specific ordering
            test_cases = []
            for std in standards:
                if std.number in ['EN 300 328', 'EN 301 489-17', 'EN 302 208', 'EN 303 413']:
                    test_cases.append(std.number)
            
            expected_order = ['EN 300 328', 'EN 301 489-17', 'EN 302 208', 'EN 303 413']
            if test_cases == expected_order:
                print("   ✓ Specific order test passed")
            else:
                print(f"   ✗ Expected: {expected_order}")
                print(f"   ✗ Got: {test_cases}")
                
        else:
            print(f"   ✗ Failed to fetch standards: {result.error_message}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n2. Testing search results sorting...")
    try:
        search_results = checker.search_standards("EN 301")
        if search_results:
            print(f"   Found {len(search_results)} search results")
            
            # Show first 10 search results
            print("\n   First 10 search results (should be in numerical order):")
            for i, std in enumerate(search_results[:10]):
                version_str = f" {std.version}" if std.version else ""
                print(f"   {i+1:2d}. {std.number}{version_str}")
            
            # Verify they're in order
            if len(search_results) >= 2:
                first_num = search_results[0].number
                second_num = search_results[1].number
                if first_num <= second_num:
                    print("   ✓ Search results are properly sorted")
                else:
                    print(f"   ✗ Search sorting issue: {first_num} should come before {second_num}")
        else:
            print("   ✗ No search results found")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\nSorting test completed!")

if __name__ == "__main__":
    test_sorting()