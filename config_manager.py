"""
Configuration Manager for EU Harmonized Standards Checker
Provides utilities for managing OJ links and directive configurations
"""

import json
import logging
from typing import Dict, List, Optional
from config import (
    DIRECTIVE_URLS, EUR_LEX_URLS, DIRECTIVE_INFO, OJ_CONFIG_FILE,
    add_directive_urls, add_amendment_url, get_available_directives, get_directive_config,
    reload_oj_config, get_oj_config
)


class ConfigurationManager:
    """Manages dynamic configuration for OJ links and directives"""
    
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.logger = logging.getLogger(__name__)
        
    def add_new_directive_to_json(self, directive_code: str, name: str, directive_number: str,
                                  main_url: str, ec_webpage: str, decision: str,
                                  amendments: List[Dict] = None, description: str = None) -> bool:
        """Add a new directive to the external JSON configuration file"""
        try:
            # Load current config
            config = get_oj_config()
            
            if directive_code in config['directives']:
                self.logger.warning(f"Directive {directive_code} already exists in configuration")
                return False
            
            # Create new directive entry
            new_directive = {
                'name': name,
                'directive_number': directive_number,
                'decision': decision,
                'ec_webpage': ec_webpage,
                'description': description or f"{name} harmonized standards",
                'oj_links': {
                    'main': main_url,
                    'amendments': amendments or []
                }
            }
            
            # Add new directive
            config['directives'][directive_code] = new_directive
            
            # Update last_updated timestamp
            from datetime import datetime
            config['last_updated'] = datetime.now().strftime('%Y-%m-%d')
            
            # Save back to file
            with open(OJ_CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            # Reload configuration
            reload_oj_config()
            
            self.logger.info(f"Added new directive to JSON config: {directive_code}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to add new directive to JSON: {str(e)}")
            return False
    
    def add_new_directive(self, directive_code: str, name: str, directive_number: str, 
                         main_url: str, ec_webpage: str, amendments: List[str] = None,
                         decision: str = None, amendment_dates: List[str] = None) -> bool:
        """Add a new directive configuration (legacy method)"""
        # Convert old format to new format
        new_amendments = []
        if amendments and amendment_dates:
            for i, url in enumerate(amendments):
                date = amendment_dates[i] if i < len(amendment_dates) else "TBD"
                new_amendments.append({
                    'url': url,
                    'date': date,
                    'description': f"Amendment to {directive_code} harmonized standards"
                })
        
        return self.add_new_directive_to_json(
            directive_code=directive_code,
            name=name,
            directive_number=directive_number,
            main_url=main_url,
            ec_webpage=ec_webpage,
            decision=decision or f'Commission Implementing Decision for {directive_code}',
            amendments=new_amendments,
            description=f"{name} harmonized standards"
        )
    
    def add_amendment_to_json(self, directive_code: str, amendment_url: str, amendment_date: str, description: str = None) -> bool:
        """Add a new amendment URL to the external JSON configuration file"""
        try:
            # Load current config
            config = get_oj_config()
            
            if directive_code not in config['directives']:
                self.logger.error(f"Directive {directive_code} not found in configuration")
                return False
            
            # Create new amendment entry
            new_amendment = {
                'url': amendment_url,
                'date': amendment_date,
                'description': description or f"Amendment to {directive_code} harmonized standards"
            }
            
            # Check if amendment already exists
            existing_amendments = config['directives'][directive_code]['oj_links']['amendments']
            for amendment in existing_amendments:
                if amendment['url'] == amendment_url:
                    self.logger.warning(f"Amendment URL already exists for {directive_code}")
                    return False
            
            # Add new amendment
            existing_amendments.append(new_amendment)
            
            # Update last_updated timestamp
            from datetime import datetime
            config['last_updated'] = datetime.now().strftime('%Y-%m-%d')
            
            # Save back to file
            with open(OJ_CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            # Reload configuration
            reload_oj_config()
            
            self.logger.info(f"Added amendment to JSON config for {directive_code}: {amendment_url}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to add amendment to JSON for {directive_code}: {str(e)}")
            return False
    
    def add_amendment(self, directive_code: str, amendment_url: str, amendment_date: str = None) -> bool:
        """Add a new amendment URL to existing directive (legacy method)"""
        return self.add_amendment_to_json(
            directive_code, 
            amendment_url, 
            amendment_date or "TBD", 
            f"Amendment to {directive_code} harmonized standards"
        )
    
    def list_directives(self) -> Dict[str, Dict]:
        """List all configured directives with their details"""
        result = {}
        for directive_code in get_available_directives():
            oj_config = get_directive_config(directive_code)
            directive_info = DIRECTIVE_INFO.get(directive_code, {})
            
            result[directive_code] = {
                'name': directive_info.get('name', 'Unknown'),
                'directive_number': directive_info.get('directive', 'Unknown'),
                'main_oj_url': oj_config.get('main', ''),
                'amendment_count': len(oj_config.get('amendments', [])),
                'ec_webpage': oj_config.get('ec_webpage', ''),
                'description': oj_config.get('description', '')
            }
        
        return result
    
    def validate_configuration(self) -> Dict[str, List[str]]:
        """Validate configuration and return any issues"""
        issues = {
            'missing_oj_config': [],
            'missing_directive_info': [],
            'invalid_urls': []
        }
        
        # Check for missing configurations
        for directive in get_available_directives():
            if directive not in DIRECTIVE_INFO:
                issues['missing_directive_info'].append(directive)
        
        for directive in DIRECTIVE_INFO.keys():
            if directive not in EUR_LEX_URLS:
                issues['missing_oj_config'].append(directive)
        
        # Basic URL validation could be added here
        
        return issues
    
    def export_configuration(self, filepath: str) -> bool:
        """Export current configuration to JSON file"""
        try:
            config_data = {
                'directive_urls': DIRECTIVE_URLS,
                'eur_lex_urls': EUR_LEX_URLS,
                'directive_info': DIRECTIVE_INFO
            }
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Configuration exported to: {filepath}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export configuration: {str(e)}")
            return False
    
    def print_configuration_summary(self):
        """Print a summary of current configuration"""
        directives = self.list_directives()
        
        print("\\n=== Configuration Summary ===")
        print(f"Total Directives: {len(directives)}")
        
        for code, info in directives.items():
            print(f"\\n{code}: {info['name']}")
            print(f"  Directive: {info['directive_number']}")
            print(f"  Amendments: {info['amendment_count']}")
            print(f"  EC Page: {info['ec_webpage']}")
        
        # Check for issues
        issues = self.validate_configuration()
        if any(issues.values()):
            print("\\n=== Configuration Issues ===")
            for issue_type, items in issues.items():
                if items:
                    print(f"{issue_type}: {', '.join(items)}")


def example_usage():
    """Example of how to use the configuration manager"""
    config_mgr = ConfigurationManager()
    
    # Example: Add a new directive
    # config_mgr.add_new_directive(
    #     directive_code="NEWDIR",
    #     name="New Directive",
    #     directive_number="2024/XX/EU",
    #     main_url="https://eur-lex.europa.eu/example",
    #     ec_webpage="https://single-market-economy.ec.europa.eu/example",
    #     amendments=["https://eur-lex.europa.eu/amendment1"],
    #     decision="Commission Implementing Decision (EU) 2024/XXXX",
    #     amendment_dates=["2024-01-01"]
    # )
    
    # Example: Add amendment to existing directive
    # config_mgr.add_amendment("RED", "https://eur-lex.europa.eu/new-amendment", "2025-12-01")
    
    # Print current configuration
    config_mgr.print_configuration_summary()


if __name__ == "__main__":
    example_usage()