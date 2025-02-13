from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_cors import CORS
from script import ProductivityAnalyzer
import logging
from functools import lru_cache
from urllib.parse import urlparse

app = Flask(__name__)

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure CORS
CORS(app, 
     resources={r"/*": {
         "origins": "*",
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "supports_credentials": True
     }})

analyzer = ProductivityAnalyzer()

@app.after_request
def after_request(response):
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Max-Age': '3600'
    })
    return response

@app.route('/get_question', methods=['POST', 'OPTIONS'])
def get_question():
    if request.method == 'OPTIONS':
        return make_response()
        
    try:
        logger.debug(f"Received request: {request.json}")
        data = request.json
        app.logger.debug(f"Received get_question request with data: {data}")
        
        domain = data.get('domain')
        context = data.get('context', {})
        
        if not domain or domain not in analyzer.settings['domains']:
            return jsonify({'error': 'Invalid domain'}), 400
        
        question = analyzer.get_next_question(domain, context)
        app.logger.debug(f"Generated question: {question}")
        
        if question.upper() == "DONE":
            return jsonify({'done': True})
        
        return jsonify({
            'question': question,
            'done': False
        })
    except Exception as e:
        app.logger.error(f"Error in get_question: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/contextualize', methods=['POST'])
def contextualize():
    data = request.json
    domain = data.get('domain')
    if not domain or domain not in analyzer.settings['domains']:
        return jsonify({'error': 'Invalid domain'}), 400
    
    analyzer.context_data = data.get('context', {})
    return jsonify({'success': True})

@lru_cache(maxsize=1000)
def cache_analysis(url, domain):
    """Cache analysis results for URLs."""
    return analyzer.analyze_website(url, domain)

# Add URL validation
def is_valid_url(url: str) -> bool:
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        url = data.get('url')
        domain = data.get('domain')
        
        logger.info(f"Analyzing URL: {url} for domain: {domain}")
        
        if not url or not domain or not is_valid_url(url):
            logger.warning(f"Invalid URL or domain: {url}")
            return jsonify({'isProductive': False}), 400
            
        if url.startswith(('chrome://', 'chrome-extension://', 'about:')):
            logger.info(f"Skipping browser internal URL: {url}")
            return jsonify({'isProductive': False})
        
        # Use cached result if available
        result = cache_analysis(url, domain)
        logger.info(f"Analysis result for {url}: {'productive' if result else 'not productive'}")
        return jsonify({'isProductive': result})
    except Exception as e:
        logger.error(f"Error analyzing website: {e}", exc_info=True)
        return jsonify({'isProductive': False, 'error': str(e)})

# Update the block page routes to serve from extension directory
@app.route('/block')
def block_page():
    return send_from_directory('extension', 'block.html')

@app.route('/block.js')
def block_js():
    return send_from_directory('extension', 'block.js')

# Update the popup route to serve with correct content type
@app.route('/ext-popup')
def popup_page():
    try:
        html_content = send_from_directory('extension', 'popup.html')
        response = make_response(html_content)
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    except Exception as e:
        logger.error(f"Error serving popup: {e}")
        return "Error loading popup", 500

# Ensure JavaScript is served with correct content type
@app.route('/popup.js')
def popup_js():
    response = make_response(send_from_directory('extension', 'popup.js'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

# Add route for static files
@app.route('/extension/<path:filename>')
def extension_files(filename):
    response = make_response(send_from_directory('extension', filename))
    if filename.endswith('.js'):
        response.headers['Content-Type'] = 'application/javascript'
    elif filename.endswith('.html'):
        response.headers['Content-Type'] = 'text/html'
    elif filename.endswith('.css'):
        response.headers['Content-Type'] = 'text/css'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
