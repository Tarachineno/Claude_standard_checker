"""
Configuration file for EU Harmonized Standards Checker System
"""

import json
import os
from typing import Dict, List, Optional

# Path to external OJ configuration file
OJ_CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'oj_config.json')

# Global variables to store loaded configuration
_oj_config = None
DIRECTIVE_URLS = {}
EUR_LEX_URLS = {}
DIRECTIVE_INFO = {}

def load_oj_config():
    """Load OJ configuration from external JSON file"""
    global _oj_config, DIRECTIVE_URLS, EUR_LEX_URLS, DIRECTIVE_INFO
    
    if _oj_config is not None:
        return _oj_config
    
    try:
        with open(OJ_CONFIG_FILE, 'r', encoding='utf-8') as f:
            _oj_config = json.load(f)
        
        # Build DIRECTIVE_URLS from loaded config
        for directive_code, directive_data in _oj_config['directives'].items():
            DIRECTIVE_URLS[directive_code] = directive_data['ec_webpage']
        
        # Build EUR_LEX_URLS from loaded config
        for directive_code, directive_data in _oj_config['directives'].items():
            oj_links = directive_data['oj_links']
            EUR_LEX_URLS[directive_code] = {
                'main': oj_links['main'],
                'amendments': [amendment['url'] for amendment in oj_links['amendments']],
                'ec_webpage': directive_data['ec_webpage'],
                'description': directive_data['description']
            }
        
        # Build DIRECTIVE_INFO from loaded config
        for directive_code, directive_data in _oj_config['directives'].items():
            oj_links = directive_data['oj_links']
            DIRECTIVE_INFO[directive_code] = {
                'name': directive_data['name'],
                'directive': directive_data['directive_number'],
                'decision': directive_data['decision'],
                'amendments': [amendment['date'] for amendment in oj_links['amendments']]
            }
        
        return _oj_config
        
    except FileNotFoundError:
        raise FileNotFoundError(f"OJ configuration file not found: {OJ_CONFIG_FILE}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in OJ configuration file: {e}")
    except KeyError as e:
        raise ValueError(f"Missing required key in OJ configuration: {e}")

def reload_oj_config():
    """Force reload of OJ configuration from file"""
    global _oj_config
    _oj_config = None
    return load_oj_config()

def get_oj_config():
    """Get the loaded OJ configuration"""
    return load_oj_config()

# Load configuration on module import
load_oj_config()

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

# Debug Configuration
DEBUG_CONFIG = {
    'enabled': False,  # デフォルトはFalse
    'detailed_parsing': True,
    'url_responses': True,
    'standard_extraction': True,
    'status_detection': True,
    'file': 'debug_standards.log'
}

# Output Configuration
OUTPUT_CONFIG = {
    'max_display_items': 100,
    'export_formats': ['txt', 'csv', 'json'],
    'report_template': 'report_template.txt'
}

# Helper functions for dynamic configuration management
def add_directive_urls(directive_code: str, main_url: str, amendments: list = None, ec_webpage: str = None, description: str = None):
    """Dynamically add new directive URLs to configuration"""
    global DIRECTIVE_URLS, EUR_LEX_URLS
    
    if amendments is None:
        amendments = []
    
    # Add to DIRECTIVE_URLS if ec_webpage is provided
    if ec_webpage:
        DIRECTIVE_URLS[directive_code] = ec_webpage
    
    # Add to EUR_LEX_URLS
    EUR_LEX_URLS[directive_code] = {
        'main': main_url,
        'amendments': amendments,
        'ec_webpage': ec_webpage or '',
        'description': description or f'{directive_code} harmonized standards'
    }

def get_available_directives():
    """Get list of available directive codes"""
    load_oj_config()  # Ensure config is loaded
    return list(EUR_LEX_URLS.keys())

def get_directive_config(directive_code: str):
    """Get configuration for a specific directive"""
    load_oj_config()  # Ensure config is loaded
    return EUR_LEX_URLS.get(directive_code, {})

def add_amendment_url(directive_code: str, amendment_url: str):
    """Add new amendment URL to existing directive configuration"""
    load_oj_config()  # Ensure config is loaded
    if directive_code in EUR_LEX_URLS:
        if amendment_url not in EUR_LEX_URLS[directive_code]['amendments']:
            EUR_LEX_URLS[directive_code]['amendments'].append(amendment_url)
            return True
    return False