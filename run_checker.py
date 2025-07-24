#!/usr/bin/env python3
"""
EU Harmonized Standards Checker - Standalone Package Launcher
Simplified version for package distribution without ISO17025 comparison features
"""

import sys
import os

# Add current directory to Python path to ensure modules can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = [
        'requests',
        'bs4',  # beautifulsoup4
        'lxml',
        'PyPDF2',
        'pdfplumber',
        'pandas',
        'tqdm',
        'jsonschema'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("❌ Missing required packages:")
        for pkg in missing_packages:
            print(f"  - {pkg}")
        print("\nPlease install missing packages:")
        print("pip install -r requirements.txt")
        return False
    
    return True

def show_welcome():
    """Show welcome message and available features"""
    print("=" * 60)
    print("EU HARMONIZED STANDARDS CHECKER - Package Version")
    print("=" * 60)
    print("\n📋 Available Features:")
    print("  ✅ 1. OJ Standards Fetching (RED, EMC, LVD)")
    print("  ✅ 2. ETSI Portal Search")
    print("  ✅ 3. ISO17025 Certificate Extraction")
    print("  ❌ 4. Standards Comparison (Not available in package version)")
    print("\n🔧 Configuration:")
    print("  - External JSON configuration (oj_config.json)")
    print("  - Easy OJ link management")
    print("  - Mobile app compatible settings")
    print("\n💾 Cache:")
    print("  - 24-hour caching for improved performance")
    print("  - Automatic cache management")
    print()

def main():
    """Main launcher function"""
    try:
        # Check dependencies
        print("🔍 Checking dependencies...")
        if not check_dependencies():
            sys.exit(1)
        
        print("✅ All dependencies are installed")
        
        # Show welcome message
        show_welcome()
        
        # Import and run the main application
        from main import main as app_main
        
        # If no arguments provided, show interactive mode by default
        if len(sys.argv) == 1:
            sys.argv.append('interactive')
        
        # Run the main application
        app_main()
        
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
        sys.exit(0)
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Please ensure all files are in the same directory")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        print("For support, check the README.md file")
        sys.exit(1)

if __name__ == "__main__":
    main()