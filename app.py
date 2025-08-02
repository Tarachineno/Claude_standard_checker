"""
Flask Web Application - EU Harmonized Standards Checker
"""

import os
import json
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime

from oj_checker import OJChecker
from etsi_searcher import ETSIPortalSearcher
from iso17025_extractor import ISO17025ScopeExtractor
from comparator import StandardComparator
from config import DIRECTIVE_INFO, get_available_directives
from utils import setup_logging

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize components
logger = setup_logging()
oj_checker = OJChecker()
etsi_searcher = ETSIPortalSearcher()
iso17025_extractor = ISO17025ScopeExtractor()
comparator = StandardComparator()

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    """Serve the main page"""
    return send_from_directory('static', 'index.html')

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/api/directives')
def get_directives():
    """Get available directives"""
    try:
        directives = []
        for code, info in DIRECTIVE_INFO.items():
            directives.append({
                'code': code,
                'name': info['name'],
                'description': info.get('description', ''),
                'directive_number': info.get('directive_number', '')
            })
        return jsonify({'success': True, 'data': directives})
    except Exception as e:
        logger.error(f"Error getting directives: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/standards/<directive>')
def get_standards(directive):
    """Get OJ standards for a specific directive"""
    try:
        directive = directive.upper()
        if directive not in DIRECTIVE_INFO:
            return jsonify({'success': False, 'error': 'Invalid directive code'}), 400
        
        result = oj_checker.fetch_standards(directive)
        
        if result.success:
            standards_data = []
            for std in result.data:
                standards_data.append({
                    'number': std.number,
                    'title': std.title,
                    'version': std.version,
                    'date': std.date.isoformat() if std.date else None,
                    'type': std.type
                })
            
            return jsonify({
                'success': True,
                'data': {
                    'directive': directive,
                    'directive_name': DIRECTIVE_INFO[directive]['name'],
                    'standards': standards_data,
                    'count': len(standards_data)
                }
            })
        else:
            return jsonify({'success': False, 'error': result.error_message}), 500
            
    except Exception as e:
        logger.error(f"Error fetching standards for {directive}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/search')
def search_standards():
    """Search standards across all directives"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'success': False, 'error': 'Search query is required'}), 400
        
        # Get all standards
        all_standards = oj_checker.get_all_standards()
        
        found_standards = []
        for directive, standards in all_standards.items():
            for std in standards:
                if (query.lower() in std.number.lower() or 
                    query.lower() in std.title.lower()):
                    
                    # Get ETSI search URL
                    etsi_result = etsi_searcher.search_standard(std.number)
                    etsi_url = etsi_result.search_url if etsi_result.success else None
                    
                    found_standards.append({
                        'directive': directive,
                        'directive_name': DIRECTIVE_INFO[directive]['name'],
                        'number': std.number,
                        'title': std.title,
                        'version': std.version,
                        'date': std.date.isoformat() if std.date else None,
                        'type': std.type,
                        'etsi_url': etsi_url
                    })
        
        return jsonify({
            'success': True,
            'data': {
                'query': query,
                'results': found_standards,
                'count': len(found_standards)
            }
        })
        
    except Exception as e:
        logger.error(f"Error searching standards: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/etsi-search/<standard>')
def etsi_search(standard):
    """Get ETSI portal search URL for a standard"""
    try:
        result = etsi_searcher.search_standard(standard)
        
        if result.success:
            return jsonify({
                'success': True,
                'data': {
                    'standard': standard,
                    'search_url': result.search_url
                }
            })
        else:
            return jsonify({'success': False, 'error': result.error_message}), 500
            
    except Exception as e:
        logger.error(f"Error getting ETSI search for {standard}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload-certificate', methods=['POST'])
def upload_certificate():
    """Upload and extract standards from ISO17025 certificate"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'error': 'Only PDF files are allowed'}), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Extract standards from PDF
        result = iso17025_extractor.extract_from_pdf(filepath)
        
        # Clean up uploaded file
        os.remove(filepath)
        
        if result.success:
            scope = result.data
            
            # Convert test standards to serializable format
            test_standards = []
            for std in scope.test_standards:
                test_standards.append({
                    'standard_number': std.standard_number,
                    'category': std.category,
                    'scope_details': std.scope_details
                })
            
            # Get standards by category
            categorized = iso17025_extractor.get_standards_by_category(scope)
            categories = {}
            for category, standards in categorized.items():
                categories[category] = [std.standard_number for std in standards]
            
            return jsonify({
                'success': True,
                'data': {
                    'certificate_info': {
                        'certificate_number': scope.certificate_info.certificate_number,
                        'organization': scope.certificate_info.organization,
                        'valid_until': scope.certificate_info.valid_until,
                        'issuing_authority': scope.certificate_info.issuing_authority
                    },
                    'test_standards': test_standards,
                    'categories': categories,
                    'total_standards': len(test_standards)
                }
            })
        else:
            return jsonify({'success': False, 'error': result.error_message}), 500
            
    except Exception as e:
        logger.error(f"Error processing certificate upload: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/compare', methods=['POST'])
def compare_standards():
    """Compare OJ standards with ISO17025 certificate standards"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        directive = data.get('directive', '').upper()
        iso_standards_data = data.get('iso_standards', [])
        
        if directive not in DIRECTIVE_INFO:
            return jsonify({'success': False, 'error': 'Invalid directive code'}), 400
        
        if not iso_standards_data:
            return jsonify({'success': False, 'error': 'No ISO standards provided'}), 400
        
        # Convert ISO standards data back to TestStandard objects
        from data_models import TestStandard
        iso_standards = []
        for std_data in iso_standards_data:
            iso_standards.append(TestStandard(
                standard_number=std_data['standard_number'],
                category=std_data.get('category', ''),
                scope_details=std_data.get('scope_details', '')
            ))
        
        # Get OJ standards
        oj_result = oj_checker.fetch_standards(directive)
        if not oj_result.success:
            return jsonify({'success': False, 'error': f'Failed to fetch OJ standards: {oj_result.error_message}'}), 500
        
        oj_standards = oj_result.data
        
        # Perform comparison
        comparison = comparator.compare_standards(oj_standards, iso_standards)
        
        # Format results
        matched_standards = []
        for oj_std, iso_std in comparison.matched_standards:
            matched_standards.append({
                'oj_standard': {
                    'number': oj_std.number,
                    'title': oj_std.title,
                    'version': oj_std.version
                },
                'iso_standard': {
                    'standard_number': iso_std.standard_number,
                    'category': iso_std.category
                }
            })
        
        oj_only_standards = []
        for std in comparison.oj_only_standards:
            oj_only_standards.append({
                'number': std.number,
                'title': std.title,
                'version': std.version
            })
        
        iso_only_standards = []
        for std in comparison.iso_only_standards:
            iso_only_standards.append({
                'standard_number': std.standard_number,
                'category': std.category
            })
        
        return jsonify({
            'success': True,
            'data': {
                'directive': directive,
                'directive_name': DIRECTIVE_INFO[directive]['name'],
                'oj_standards_count': len(oj_standards),
                'iso_standards_count': len(iso_standards),
                'matched_count': len(comparison.matched_standards),
                'coverage_percentage': comparison.coverage_percentage,
                'matched_standards': matched_standards,
                'oj_only_standards': oj_only_standards,
                'iso_only_standards': iso_only_standards
            }
        })
        
    except Exception as e:
        logger.error(f"Error comparing standards: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/batch-compare', methods=['POST'])
def batch_compare_standards():
    """Compare ISO17025 standards with all directives"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        iso_standards_data = data.get('iso_standards', [])
        
        if not iso_standards_data:
            return jsonify({'success': False, 'error': 'No ISO standards provided'}), 400
        
        # Convert ISO standards data back to TestStandard objects
        from data_models import TestStandard
        iso_standards = []
        for std_data in iso_standards_data:
            iso_standards.append(TestStandard(
                standard_number=std_data['standard_number'],
                category=std_data.get('category', ''),
                scope_details=std_data.get('scope_details', '')
            ))
        
        # Get all OJ standards
        oj_standards = oj_checker.get_all_standards()
        
        # Perform batch comparison
        comparison_results = comparator.batch_compare(oj_standards, iso_standards)
        
        # Format results
        results = {}
        for directive, comparison in comparison_results.items():
            matched_standards = []
            for oj_std, iso_std in comparison.matched_standards:
                matched_standards.append({
                    'oj_standard': {
                        'number': oj_std.number,
                        'title': oj_std.title,
                        'version': oj_std.version
                    },
                    'iso_standard': {
                        'standard_number': iso_std.standard_number,
                        'category': iso_std.category
                    }
                })
            
            results[directive] = {
                'directive_name': DIRECTIVE_INFO[directive]['name'],
                'coverage_percentage': comparison.coverage_percentage,
                'matched_count': len(comparison.matched_standards),
                'oj_count': len(comparison.oj_only_standards) + len(comparison.matched_standards),
                'matched_standards': matched_standards
            }
        
        # Find best matching directive
        best_directive = comparator.get_best_directive_match(iso_standards, oj_standards)
        
        return jsonify({
            'success': True,
            'data': {
                'iso_standards_count': len(iso_standards),
                'results': results,
                'best_directive': best_directive,
                'best_directive_name': DIRECTIVE_INFO[best_directive]['name'] if best_directive in DIRECTIVE_INFO else None
            }
        })
        
    except Exception as e:
        logger.error(f"Error in batch comparison: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.errorhandler(413)
def file_too_large(e):
    return jsonify({'success': False, 'error': 'File too large. Maximum size is 16MB.'}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}")
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)