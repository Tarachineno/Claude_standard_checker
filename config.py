"""
Configuration file for EU Harmonized Standards Checker System
"""

# EU Directive URLs
DIRECTIVE_URLS = {
    'RE': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en',
    'EMC': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en',
    'LVD': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en'
}

# Directive Information
DIRECTIVE_INFO = {
    'RE': {
        'name': 'Radio Equipment Directive',
        'directive': '2014/53/EU',
        'decision': 'Commission Implementing Decision (EU) 2022/2191',
        'amendments': ['2023/10/03', '2023/11/27', '2025/01/28', '2025/05/14']
    },
    'EMC': {
        'name': 'Electromagnetic Compatibility Directive',
        'directive': '2014/30/EU',
        'decision': 'Commission Implementing Decision (EU) 2019/1326',
        'amendments': []
    },
    'LVD': {
        'name': 'Low Voltage Directive',
        'directive': '2014/35/EU',
        'decision': 'Commission Implementing Decision (EU) 2023/2723',
        'amendments': ['2024/04/19', '2024/10/30']
    }
}

# ETSI Portal Configuration
ETSI_PORTAL = {
    'base_url': 'https://portal.etsi.org/webapp/WorkProgram/Frame_WorkItemList.asp',
    'search_params': {
        'SearchPage': 'TRUE',
        'qSORT': 'HIGHVERSION',
        'qINCLUDE_SUB_TB': 'True',
        'qETSI_ALL': 'TRUE',
        'qREPORT_TYPE': 'SUMMARY',
        'optDisplay': '10',
        'includeNonActiveTB': 'FALSE',
        'butSimple': '++Search++'
    }
}

# Standard Patterns for ISO17025 Extraction
STANDARD_PATTERNS = {
    'EN': r'EN\s+\d+\s+\d+(?:-\d+)*',
    'ETSI': r'ETSI\s+EN\s+\d+\s+\d+(?:-\d+)*',
    'IEC': r'IEC\s+\d+(?:-\d+)*',
    'CISPR': r'CISPR\s+\d+',
    'ANSI': r'ANSI\s+C\d+\.\d+:\d+',
    'FCC': r'CFR\s+47,\s+FCC\s+Part\s+\d+[A-Z]?',
    'ISO': r'ISO\s+\d+(?:-\d+)*',
    'AS_NZS': r'AS/NZS\s+\d+',
    'KS': r'KS\s+C\s*\d+(?:-\d+)*',
    'RSS': r'RSS-\w+',
    'ICES': r'ICES-\w+',
    'SEMI': r'SEMI\s+[A-Z]\d+'
}

# HTTP Request Configuration
HTTP_CONFIG = {
    'timeout': 30,
    'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    'retry_attempts': 3,
    'retry_delay': 1
}

# Cache Configuration
CACHE_CONFIG = {
    'enabled': True,
    'cache_dir': './cache',
    'cache_duration': 86400  # 24 hours in seconds
}

# Logging Configuration
LOGGING_CONFIG = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': 'standards_checker.log'
}

# Output Configuration
OUTPUT_CONFIG = {
    'max_display_items': 100,
    'export_formats': ['txt', 'csv', 'json'],
    'report_template': 'report_template.txt'
}