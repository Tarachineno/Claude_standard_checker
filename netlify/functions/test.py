"""
Simple test function for Netlify to verify basic connectivity
"""

import json

def handler(event, context):
    """
    Simple test handler that returns a basic JSON response
    """
    try:
        method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')
        
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
                'message': 'Netlify functions are working!',
                'method': method,
                'path': path,
                'timestamp': '2025-08-02T20:00:00Z'
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