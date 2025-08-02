"""
Netlify Functions handler for the EU Harmonized Standards Checker API
"""

import json
import os
import sys
import io
from urllib.parse import parse_qs

# Add the project root to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(current_dir, '..', '..')
sys.path.insert(0, project_root)

def handler(event, context):
    """
    Netlify Functions handler that routes requests to the Flask app
    """
    try:
        # Import Flask app here to avoid import issues
        from app import app
        
        # Parse the request
        method = event.get('httpMethod', 'GET')
        raw_path = event.get('path', '/')
        query_string = event.get('queryStringParameters') or {}
        headers = event.get('headers', {})
        body = event.get('body', '')
        
        # Debug logging
        print(f"Netlify function called - Method: {method}, Path: {raw_path}")
        
        # Extract API path from the full path
        # Remove /.netlify/functions/api prefix to get the actual API path
        if raw_path.startswith('/.netlify/functions/api'):
            api_path = raw_path[len('/.netlify/functions/api'):]
            if not api_path:
                api_path = '/'
        else:
            api_path = raw_path
        
        # Ensure API path starts with /api for Flask routing
        if not api_path.startswith('/api'):
            if api_path.startswith('/'):
                api_path = '/api' + api_path
            else:
                api_path = '/api/' + api_path
        
        print(f"Transformed API path: {api_path}")
        
        # Convert query parameters to proper format
        query_string_formatted = '&'.join([f"{k}={v}" for k, v in query_string.items()])
        
        # Handle body for POST requests
        wsgi_input = io.BytesIO()
        if body:
            if event.get('isBase64Encoded', False):
                import base64
                body_bytes = base64.b64decode(body)
            else:
                body_bytes = body.encode('utf-8')
            wsgi_input.write(body_bytes)
            wsgi_input.seek(0)
        
        # Create WSGI environ for Flask
        environ = {
            'REQUEST_METHOD': method,
            'PATH_INFO': api_path,
            'QUERY_STRING': query_string_formatted,
            'CONTENT_TYPE': headers.get('content-type', ''),
            'CONTENT_LENGTH': str(len(body)) if body else '0',
            'HTTP_HOST': headers.get('host', 'localhost'),
            'wsgi.input': wsgi_input,
            'wsgi.errors': sys.stderr,
            'wsgi.version': (1, 0),
            'wsgi.multithread': False,
            'wsgi.multiprocess': True,
            'wsgi.run_once': False,
            'wsgi.url_scheme': 'https',
            'SERVER_NAME': headers.get('host', 'localhost').split(':')[0],
            'SERVER_PORT': '443',
        }
        
        # Add headers to environ
        for key, value in headers.items():
            key = key.upper().replace('-', '_')
            if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                key = 'HTTP_' + key
            environ[key] = value
        
        # Capture response
        response_data = []
        response_status = None
        response_headers = []
        
        def start_response(status, headers, exc_info=None):
            nonlocal response_status, response_headers
            response_status = status
            response_headers = headers
            return response_data.append
        
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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Content-Type': 'application/json'
        })
        
        print(f"Returning response - Status: {status_code}, Body length: {len(response_body)}")
        
        return {
            'statusCode': status_code,
            'headers': headers_dict,
            'body': response_body
        }
        
    except Exception as e:
        # Log the error
        print(f"Error in Netlify function: {str(e)}")
        import traceback
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