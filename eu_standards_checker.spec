# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for EU Harmonized Standards Checker
Creates a standalone executable with all dependencies bundled
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Get the current directory
current_dir = os.path.abspath('.')

# Collect data files and hidden imports
datas = [
    ('oj_config.json', '.'),
    ('README_PACKAGE.md', '.'),
    ('requirements.txt', '.'),
]

# Hidden imports for packages that might not be detected automatically
hiddenimports = [
    'requests',
    'requests.adapters',
    'requests.auth',
    'requests.cookies',
    'requests.exceptions',
    'requests.models',
    'requests.sessions',
    'requests.utils',
    'urllib3',
    'urllib3.util',
    'urllib3.util.retry',
    'urllib3.exceptions',
    'bs4',
    'bs4.builder',
    'bs4.builder._html5lib',
    'bs4.builder._htmlparser',
    'bs4.builder._lxml',
    'lxml',
    'lxml.etree',
    'lxml.html',
    'PyPDF2',
    'PyPDF2.pdf',
    'pdfplumber',
    'pdfplumber.pdf',
    'pandas',
    'pandas.core',
    'pandas.io',
    'pandas.io.formats',
    'pandas.io.formats.format',
    'openpyxl',
    'dateutil',
    'dateutil.parser',
    'json',
    'csv',
    'logging',
    'os',
    'sys',
    'datetime',
    'time',
    'hashlib',
    're',
    'webbrowser',
]

# Collect additional data files from packages
try:
    # Collect lxml data files
    datas += collect_data_files('lxml')
except:
    pass

try:
    # Collect pandas data files
    datas += collect_data_files('pandas')
except:
    pass

a = Analysis(
    ['run_checker.py'],
    pathex=[current_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy.distutils',
        'scipy',
        'PIL',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
        'setuptools',
        'pip',
        'wheel',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='eu_standards_checker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add icon file path here if available
)

# Optional: Create additional info
if sys.platform == 'win32':
    exe.version_info = {
        'version': (1, 0, 0, 0),
        'file_version': (1, 0, 0, 0),
        'product_version': (1, 0, 0, 0),
        'file_description': 'EU Harmonized Standards Checker',
        'product_name': 'EU Standards Checker',
        'company_name': 'Claude Code Generated',
        'copyright': '2025 EU Standards Checker'
    }