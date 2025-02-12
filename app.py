from flask import Flask, request, jsonify
from flask_cors import CORS
from script import ProductivityAnalyzer

app = Flask(__name__)
CORS(app)

analyzer = ProductivityAnalyzer()

@app.route('/get_question', methods=['POST'])
def get_question():
    data = request.json
    domain = data.get('domain')
    context = data.get('context', {})
    
    if not domain or domain not in analyzer.settings['domains']:
        return jsonify({'error': 'Invalid domain'}), 400
    
    question = analyzer.get_next_question(domain, context)
    if question == "DONE":
        return jsonify({'done': True})
    
    return jsonify({
        'question': question,
        'done': False
    })

@app.route('/contextualize', methods=['POST'])
def contextualize():
    data = request.json
    domain = data.get('domain')
    if not domain or domain not in analyzer.settings['domains']:
        return jsonify({'error': 'Invalid domain'}), 400
    
    analyzer.context_data = data.get('context', {})
    return jsonify({'success': True})

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    url = data.get('url')
    domain = data.get('domain')
    
    if not url or not domain:
        return jsonify({'error': 'Missing url or domain'}), 400
        
    result = analyzer.analyze_website(url, domain)
    return jsonify({'isProductive': result})

if __name__ == '__main__':
    app.run(port=5000)
