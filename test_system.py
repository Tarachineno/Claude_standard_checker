#!/usr/bin/env python3
"""
Simple test script to verify the EU Harmonized Standards Checker system works
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import HarmonizedStandardsChecker

def test_system():
    """Test the basic functionality of the system"""
    print("Testing EU Harmonized Standards Checker System...")
    
    # Initialize the checker
    checker = HarmonizedStandardsChecker()
    
    # Test 1: Check if we can fetch standards for RE directive
    print("\n1. Testing OJ standards fetching for RE directive...")
    try:
        result = checker.oj_checker.fetch_standards("RE")
        if result.success:
            print(f"   ✓ Successfully fetched {len(result.data)} RE standards")
            # Print first few standards
            for i, std in enumerate(result.data[:3]):
                print(f"   - {std.number} {std.version}")
        else:
            print(f"   ✗ Failed to fetch RE standards: {result.error_message}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 2: Check ETSI search URL generation
    print("\n2. Testing ETSI search URL generation...")
    try:
        etsi_result = checker.etsi_searcher.search_standard("EN 301 489-17")
        if etsi_result.success:
            print(f"   ✓ Successfully generated ETSI search URL")
            print(f"   URL: {etsi_result.search_url}")
        else:
            print(f"   ✗ Failed to generate ETSI URL: {etsi_result.error_message}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 3: Check standards search functionality
    print("\n3. Testing standards search functionality...")
    try:
        search_results = checker.oj_checker.search_standards("EN 301")
        if search_results:
            print(f"   ✓ Found {len(search_results)} standards matching 'EN 301'")
            for std in search_results[:2]:
                print(f"   - {std.number} {std.version}")
        else:
            print("   ✗ No standards found for 'EN 301'")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 4: Check all directives
    print("\n4. Testing all directives...")
    try:
        all_standards = checker.oj_checker.get_all_standards()
        total_count = sum(len(standards) for standards in all_standards.values())
        print(f"   ✓ Successfully fetched standards for all directives")
        for directive, standards in all_standards.items():
            print(f"   - {directive}: {len(standards)} standards")
        print(f"   Total: {total_count} standards")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 5: Check cache functionality
    print("\n5. Testing cache functionality...")
    try:
        from utils import create_cache_key, save_to_cache, load_from_cache
        
        # Create test cache entry
        test_key = create_cache_key("test", "data")
        test_data = {"test": "value"}
        
        # Save to cache
        save_to_cache(test_key, test_data)
        
        # Load from cache
        cached_data = load_from_cache(test_key)
        
        if cached_data and cached_data.get("test") == "value":
            print("   ✓ Cache functionality working correctly")
        else:
            print("   ✗ Cache functionality not working")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\nTest completed!")

if __name__ == "__main__":
    test_system()