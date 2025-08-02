"""
Simple directives endpoint for Netlify
"""

import json

def handler(event, context):
    """
    Return available directives without dependencies
    """
    try:
        # Hardcoded directives data to avoid dependency issues
        directives = [
            {
                'code': 'RED',
                'name': 'Radio Equipment Directive',
                'description': 'Radio Equipment Directive (RED)',
                'directive_number': '2014/53/EU'
            },
            {
                'code': 'EMC',
                'name': 'Electromagnetic Compatibility Directive',
                'description': 'EMC Directive',
                'directive_number': '2014/30/EU'
            },
            {
                'code': 'LVD',
                'name': 'Low Voltage Directive',
                'description': 'Low Voltage Directive',
                'directive_number': '2014/35/EU'
            }
        ]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            'body': json.dumps({
                'success': True,
                'data': directives
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }