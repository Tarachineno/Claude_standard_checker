#!/usr/bin/env python3
"""
Build Script for EU Harmonized Standards Checker Executable
Creates a standalone executable using PyInstaller
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_pyinstaller():
    """Check if PyInstaller is installed"""
    try:
        import PyInstaller
        print(f"✅ PyInstaller {PyInstaller.__version__} is installed")
        return True
    except ImportError:
        print("❌ PyInstaller is not installed")
        print("Please install it with: pip install pyinstaller")
        return False

def check_dependencies():
    """Check if all required dependencies are installed"""
    required_packages = [
        'requests', 'bs4', 'lxml', 'PyPDF2', 'pdfplumber', 'pandas', 'urllib3'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print("❌ Missing required packages:")
        for pkg in missing:
            print(f"  - {pkg}")
        print("\nPlease install them with:")
        print("pip install -r requirements.txt")
        return False
    
    print("✅ All required dependencies are installed")
    return True

def clean_build_dirs():
    """Clean previous build directories"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            print(f"🧹 Cleaning {dir_name}...")
            shutil.rmtree(dir_name)

def build_executable():
    """Build the executable using PyInstaller"""
    print("\n🔨 Building executable...")
    print("This may take 5-10 minutes...")
    
    try:
        # Run PyInstaller with the spec file
        result = subprocess.run([
            sys.executable, '-m', 'PyInstaller',
            '--clean',
            '--noconfirm',
            'eu_standards_checker.spec'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Build completed successfully!")
            return True
        else:
            print("❌ Build failed!")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Build error: {e}")
        return False

def verify_executable():
    """Verify the built executable"""
    exe_path = Path('dist') / 'eu_standards_checker'
    if sys.platform == 'win32':
        exe_path = exe_path.with_suffix('.exe')
    
    if exe_path.exists():
        file_size = exe_path.stat().st_size / (1024 * 1024)  # MB
        print(f"✅ Executable created: {exe_path}")
        print(f"📦 File size: {file_size:.1f} MB")
        
        # Test execution
        print("\n🧪 Testing executable...")
        try:
            result = subprocess.run([str(exe_path), '--help'], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Executable test passed")
            else:
                print("⚠️  Executable test returned non-zero exit code")
                print("Output:", result.stdout)
                print("Error:", result.stderr)
        except subprocess.TimeoutExpired:
            print("⚠️  Executable test timed out")
        except Exception as e:
            print(f"⚠️  Executable test failed: {e}")
        
        return True
    else:
        print("❌ Executable not found!")
        return False

def create_distribution_package():
    """Create a distribution package with documentation"""
    if not Path('dist').exists():
        return False
    
    print("\n📦 Creating distribution package...")
    
    # Copy important files to dist
    files_to_copy = [
        'README_PACKAGE.md',
        'oj_config.json',
        'requirements.txt'
    ]
    
    for file_name in files_to_copy:
        if Path(file_name).exists():
            shutil.copy2(file_name, 'dist/')
            print(f"📄 Copied {file_name}")
    
    # Create a simple usage text file
    usage_text = """EU Harmonized Standards Checker - Standalone Executable

USAGE:
  Double-click eu_standards_checker.exe (Windows)
  Or run: ./eu_standards_checker (Linux/Mac)

FEATURES:
✅ OJ Standards fetching (RED, EMC, LVD)
✅ ETSI Portal search  
✅ ISO17025 certificate extraction
✅ External JSON configuration management

No Python installation required!
All dependencies are bundled in this executable.

For support: https://github.com/Tarachineno/Claude_standard_checker
"""
    
    with open('dist/USAGE.txt', 'w', encoding='utf-8') as f:
        f.write(usage_text)
    
    print("📄 Created USAGE.txt")
    print("✅ Distribution package ready in 'dist/' folder")

def main():
    """Main build process"""
    print("=" * 60)
    print("EU HARMONIZED STANDARDS CHECKER")
    print("Executable Build Script")
    print("=" * 60)
    
    # Step 1: Check PyInstaller
    if not check_pyinstaller():
        return False
    
    # Step 2: Check dependencies
    if not check_dependencies():
        return False
    
    # Step 3: Clean previous builds
    clean_build_dirs()
    
    # Step 4: Build executable
    if not build_executable():
        return False
    
    # Step 5: Verify executable
    if not verify_executable():
        return False
    
    # Step 6: Create distribution package
    create_distribution_package()
    
    print("\n" + "=" * 60)
    print("🎉 BUILD COMPLETED SUCCESSFULLY!")
    print("📁 Executable location: dist/eu_standards_checker")
    print("📦 Ready for distribution!")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)