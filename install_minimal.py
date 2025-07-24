#!/usr/bin/env python3
"""
Minimal Installation Script for EU Harmonized Standards Checker
For installation-restricted environments
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a single package"""
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
        return True
    except subprocess.CalledProcessError:
        return False

def main():
    """Install minimal required packages"""
    print("=" * 60)
    print("EU HARMONIZED STANDARDS CHECKER")
    print("Minimal Installation for Restricted Environments")
    print("=" * 60)
    
    # Required packages only
    required_packages = [
        'requests>=2.31.0',
        'beautifulsoup4>=4.12.0', 
        'lxml>=4.9.0',
        'urllib3>=2.0.0',
        'PyPDF2>=3.0.1',
        'pdfplumber>=0.11.0',
        'pandas>=2.0.0'
    ]
    
    print(f"\n📦 Installing {len(required_packages)} required packages...")
    
    failed_packages = []
    
    for i, package in enumerate(required_packages, 1):
        package_name = package.split('>=')[0]
        print(f"[{i}/{len(required_packages)}] Installing {package_name}...", end=' ')
        
        if install_package(package):
            print("✅ Success")
        else:
            print("❌ Failed")
            failed_packages.append(package_name)
    
    print("\n" + "=" * 60)
    
    if failed_packages:
        print("❌ Installation completed with errors")
        print("Failed packages:")
        for pkg in failed_packages:
            print(f"  - {pkg}")
        print("\nPlease install failed packages manually or check your network connection.")
        return False
    else:
        print("✅ Minimal installation completed successfully!")
        print("\nYou can now run the checker with:")
        print("  python run_checker.py")
        print("\nNote: Some features may be limited without optional packages.")
        print("Optional packages (tqdm, jsonschema, etc.) can be installed later if needed.")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)