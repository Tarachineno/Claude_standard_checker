"""
OJ Configuration Validator
Validates the oj_config.json file structure and content
"""

import json
import re
from typing import Dict, List, Tuple, Optional
from urllib.parse import urlparse


class OJConfigValidator:
    """Validates OJ configuration file structure and content"""
    
    def __init__(self, config_file: str):
        self.config_file = config_file
        self.errors = []
        self.warnings = []
        
    def validate(self) -> Tuple[bool, List[str], List[str]]:
        """
        Validate the OJ configuration file
        Returns: (is_valid, errors, warnings)
        """
        self.errors = []
        self.warnings = []
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except FileNotFoundError:
            self.errors.append(f"Configuration file not found: {self.config_file}")
            return False, self.errors, self.warnings
        except json.JSONDecodeError as e:
            self.errors.append(f"Invalid JSON format: {e}")
            return False, self.errors, self.warnings
        
        # Validate top-level structure
        self._validate_top_level(config)
        
        # Validate directives
        if 'directives' in config:
            self._validate_directives(config['directives'])
        
        # Validate metadata
        if 'metadata' in config:
            self._validate_metadata(config['metadata'])
        
        is_valid = len(self.errors) == 0
        return is_valid, self.errors, self.warnings
    
    def _validate_top_level(self, config: Dict):
        """Validate top-level configuration structure"""
        required_fields = ['version', 'last_updated', 'description', 'directives']
        
        for field in required_fields:
            if field not in config:
                self.errors.append(f"Missing required top-level field: {field}")
        
        # Validate version format
        if 'version' in config:
            version = config['version']
            if not re.match(r'^\d+\.\d+$', str(version)):
                self.warnings.append(f"Version format should be X.Y: {version}")
        
        # Validate date format
        if 'last_updated' in config:
            date = config['last_updated']
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(date)):
                self.warnings.append(f"Date format should be YYYY-MM-DD: {date}")
    
    def _validate_directives(self, directives: Dict):
        """Validate directives configuration"""
        if not directives:
            self.errors.append("No directives configured")
            return
        
        for directive_code, directive_data in directives.items():
            self._validate_single_directive(directive_code, directive_data)
    
    def _validate_single_directive(self, directive_code: str, directive_data: Dict):
        """Validate a single directive configuration"""
        required_fields = ['name', 'directive_number', 'decision', 'ec_webpage', 'description', 'oj_links']
        
        for field in required_fields:
            if field not in directive_data:
                self.errors.append(f"Directive {directive_code}: Missing required field '{field}'")
        
        # Validate directive code format
        if not re.match(r'^[A-Z]+$', directive_code):
            self.warnings.append(f"Directive code should be uppercase letters only: {directive_code}")
        
        # Validate directive number format
        if 'directive_number' in directive_data:
            number = directive_data['directive_number']
            if not re.match(r'^\d{4}/\d+/EU$', str(number)):
                self.warnings.append(f"Directive number format should be YYYY/XX/EU: {number}")
        
        # Validate URLs
        if 'ec_webpage' in directive_data:
            self._validate_url(directive_data['ec_webpage'], f"Directive {directive_code} EC webpage")
        
        # Validate OJ links
        if 'oj_links' in directive_data:
            self._validate_oj_links(directive_code, directive_data['oj_links'])
    
    def _validate_oj_links(self, directive_code: str, oj_links: Dict):
        """Validate OJ links structure"""
        required_fields = ['main', 'amendments']
        
        for field in required_fields:
            if field not in oj_links:
                self.errors.append(f"Directive {directive_code} OJ links: Missing required field '{field}'")
        
        # Validate main URL
        if 'main' in oj_links:
            self._validate_url(oj_links['main'], f"Directive {directive_code} main OJ URL")
        
        # Validate amendments
        if 'amendments' in oj_links:
            amendments = oj_links['amendments']
            if not isinstance(amendments, list):
                self.errors.append(f"Directive {directive_code}: amendments must be a list")
            else:
                for i, amendment in enumerate(amendments):
                    self._validate_amendment(directive_code, i, amendment)
    
    def _validate_amendment(self, directive_code: str, index: int, amendment: Dict):
        """Validate a single amendment entry"""
        required_fields = ['url', 'date', 'description']
        
        for field in required_fields:
            if field not in amendment:
                self.errors.append(f"Directive {directive_code} amendment {index}: Missing required field '{field}'")
        
        # Validate URL
        if 'url' in amendment:
            self._validate_url(amendment['url'], f"Directive {directive_code} amendment {index} URL")
        
        # Validate date format
        if 'date' in amendment:
            date = amendment['date']
            if date != "TBD" and not re.match(r'^\d{4}-\d{2}-\d{2}$', str(date)):
                self.warnings.append(f"Directive {directive_code} amendment {index}: Date format should be YYYY-MM-DD or 'TBD': {date}")
    
    def _validate_url(self, url: str, context: str):
        """Validate URL format"""
        if not url:
            self.errors.append(f"{context}: URL cannot be empty")
            return
        
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                self.errors.append(f"{context}: Invalid URL format: {url}")
            elif parsed.scheme not in ['http', 'https']:
                self.warnings.append(f"{context}: URL should use HTTP/HTTPS: {url}")
            elif 'eur-lex.europa.eu' not in parsed.netloc and 'single-market-economy.ec.europa.eu' not in parsed.netloc:
                self.warnings.append(f"{context}: URL should be from official EU domains: {url}")
        except Exception as e:
            self.errors.append(f"{context}: URL validation error: {e}")
    
    def _validate_metadata(self, metadata: Dict):
        """Validate metadata section"""
        if 'api_compatibility' in metadata:
            compatibility = metadata['api_compatibility']
            expected_platforms = ['mobile_app', 'web_service', 'desktop_app']
            
            for platform in expected_platforms:
                if platform not in compatibility:
                    self.warnings.append(f"Metadata: Missing API compatibility info for {platform}")
                elif not isinstance(compatibility[platform], bool):
                    self.errors.append(f"Metadata: API compatibility for {platform} should be boolean")
    
    def print_validation_report(self):
        """Print validation report"""
        is_valid, errors, warnings = self.validate()
        
        print(f"\\n=== OJ Configuration Validation Report ===")
        print(f"File: {self.config_file}")
        print(f"Status: {'✓ VALID' if is_valid else '✗ INVALID'}")
        
        if errors:
            print(f"\\n❌ Errors ({len(errors)}):")
            for error in errors:
                print(f"  - {error}")
        
        if warnings:
            print(f"\\n⚠️  Warnings ({len(warnings)}):")
            for warning in warnings:
                print(f"  - {warning}")
        
        if not errors and not warnings:
            print("\\n✅ Configuration is valid with no issues")
        
        return is_valid


def validate_oj_config_file(config_file: str) -> bool:
    """Convenience function to validate OJ config file"""
    validator = OJConfigValidator(config_file)
    return validator.print_validation_report()


if __name__ == "__main__":
    import os
    config_file = os.path.join(os.path.dirname(__file__), 'oj_config.json')
    validate_oj_config_file(config_file)