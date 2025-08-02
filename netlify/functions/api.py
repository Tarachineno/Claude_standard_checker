"""
Netlify Functions handler for the EU Harmonized Standards Checker API
"""

import json
import os
import sys
import traceback
from urllib.parse import parse_qs, urlparse

# Add the project root to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from app import app

def handler(event, context):
    """
    Netlify Functions handler that routes requests to the Flask app
    """
    try:
        # Parse the request
        method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')
        query_string = event.get('queryStringParameters') or {}
        headers = event.get('headers', {})
        body = event.get('body', '')
        
        # Convert query parameters to proper format
        query_string_formatted = '&'.join([f"{k}={v}" for k, v in query_string.items()])
        
        # Create a mock WSGI environ for Flask
        environ = {
            'REQUEST_METHOD': method,
            'PATH_INFO': path,
            'QUERY_STRING': query_string_formatted,
            'CONTENT_TYPE': headers.get('content-type', ''),
            'CONTENT_LENGTH': str(len(body)) if body else '0',
            'HTTP_HOST': headers.get('host', 'localhost'),
            'wsgi.input': body,
            'wsgi.errors': sys.stderr,
            'wsgi.version': (1, 0),
            'wsgi.multithread': False,
            'wsgi.multiprocess': True,
            'wsgi.run_once': False,
            'wsgi.url_scheme': 'https',
        }
        
        # Add headers to environ
        for key, value in headers.items():
            key = key.upper().replace('-', '_')
            if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                key = 'HTTP_' + key
            environ[key] = value
        
        # Create a simple WSGI app wrapper
        response_data = []
        response_status = None
        response_headers = []
        
        def start_response(status, headers):
            nonlocal response_status, response_headers
            response_status = status
            response_headers = headers
            return lambda x: None
        
        # Call the Flask app
        with app.app_context():
            app_response = app.wsgi_app(environ, start_response)
            response_body = b''.join(app_response).decode('utf-8')
        
        # Parse status code
        status_code = int(response_status.split(' ')[0])
        
        # Convert headers to dict
        headers_dict = {}
        for header_name, header_value in response_headers:
            headers_dict[header_name] = header_value
        
        # Ensure CORS headers for all responses
        headers_dict.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        })
        
        return {
            'statusCode': status_code,
            'headers': headers_dict,
            'body': response_body
        }
        
    except Exception as e:
        # Log the error
        print(f"Error in Netlify function: {str(e)}")
        print(traceback.format_exc())
        
        # Return error response
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            'body': json.dumps({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            })
        }