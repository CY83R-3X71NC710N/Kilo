import os
import json
import requests
from google import genai
from typing import Dict, List
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from flask import Flask, request, jsonify

def load_api_key() -> str:
    """Load API key from file or environment variable."""
    api_key = os.getenv("API_KEY")
    if not api_key:
        try:
            with open("api_key.txt", "r") as f:
                api_key = f.read().strip()
        except FileNotFoundError:
            raise Exception("API key not found in environment or api_key.txt")
    return api_key

def load_domain_settings() -> Dict:
    """Load domain settings from settings.json."""
    with open("settings.json", "r") as f:
        return json.load(f)

class ProductivityAnalyzer:
    def __init__(self):
        self.api_key = load_api_key()
        self.settings = load_domain_settings()
        self.client = genai.Client(api_key=self.api_key)
        self.context_data = {}
        
    def contextualize(self, domain: str) -> None:
        """Ask focused questions one at a time to contextualize the task."""
        # Initial prompt to get the first question
        initial_prompt = f"You are an AI assistant helping understand a {domain} task. Ask a single specific question to understand the task better. Keep the question short and direct. Do not include any numbering, formatting, or extra text."
        
        # Track conversation to maintain context
        conversation_history = []
        
        while True:
            # Generate next question based on conversation history
            prompt = initial_prompt
            if conversation_history:
                prompt = f"Based on previous answers, ask the next most relevant single question about the {domain} task, or respond with exactly 'DONE' if you have enough information. Previous Q&A: {json.dumps(conversation_history)}"
            
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            
            question = response.text.strip()
            
            # Check if we have enough information
            if question.upper() == 'DONE':
                break
                
            # Get user's answer with clean formatting
            print("\n" + question)
            print("-" * 40)
            answer = input("Answer: ")
            print()  # Add extra line break for readability
            
            # Store Q&A pair
            conversation_history.append({"question": question, "answer": answer})
            self.context_data[question] = answer

    def _get_domain_from_url(self, url: str) -> str:
        """Extract the base domain from a URL."""
        parsed = urlparse(url)
        return parsed.netloc.lower()

    def _is_allowed_platform(self, url: str, domain: str) -> bool:
        """Check if URL belongs to allowed platforms."""
        base_domain = self._get_domain_from_url(url)
        settings = self.settings["domains"][domain]
        
        # AI tool detection
        ai_patterns = {
            "chatgpt": ["chat.openai.com", "chatgpt.com"],
            "bard": ["bard.google.com"],
            "claude": ["claude.ai"],
            "gemini": ["gemini.google.com"],
            "copilot": ["copilot.github.com"]
        }
        
        for ai_tool, domains in ai_patterns.items():
            if any(base_domain.endswith(ai_domain) for ai_domain in domains):
                # Changed: use case-insensitive comparison for ai_tools check
                return "ai_tools" in settings and ai_tool.lower() in [tool.lower() for tool in settings["ai_tools"]]
        
        # Check other platforms
        if "lms_platforms" in settings:
            for lms in settings["lms_platforms"]:
                if base_domain.endswith(lms.lower()):
                    return True
        
        if "productivity_tools" in settings:
            for tool in settings["productivity_tools"]:
                if base_domain.endswith(tool.lower().replace("_", "")):
                    return True
                
        return False

    def _is_ai_site(self, url: str) -> bool:
        """Check if the URL belongs to a known AI tool site."""
        base_domain = self._get_domain_from_url(url)
        ai_patterns = [
            "chat.openai.com", "chatgpt.com",
            "bard.google.com",
            "claude.ai",
            "gemini.google.com",
            "copilot.github.com"
        ]
        return any(base_domain.endswith(ai_domain) for ai_domain in ai_patterns)

    def analyze_website(self, url: str, domain: str) -> bool:
        """Analyze if a website is productive for the given domain and context."""
        try:
            # If it's an AI site and not allowed by settings, short-circuit
            if self._is_ai_site(url) and not self._is_allowed_platform(url, domain):
                return False

            # First check if it's an allowed platform
            if self._is_allowed_platform(url, domain):
                return True

            # For other websites, perform content analysis
            response = requests.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            site_data = {
                "title": soup.title.string if soup.title else "",
                "content": soup.get_text()[:1000],  # First 1000 chars
                "domain": domain,
                "context": self.context_data,
                "settings": self.settings["domains"][domain],
                "url": url
            }
            
            prompt = f"""Based on this data, determine if this website is productive for the task. 
            Consider:
            1. The user's context: {json.dumps(self.context_data)}
            2. The website content
            3. The domain settings
            
            Respond with only 'YES' or 'NO'.
            
            Data: {json.dumps(site_data)}"""
            
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            return response.text.strip().upper() == 'YES'
            
        except Exception as e:
            print(f"Error analyzing website: {e}")
            return False

    def fetch_questions(self) -> List[str]:
        """Fetch contextualization questions."""
        initial_prompt = "You are an AI assistant helping understand a task. Ask a series of specific questions to understand the task better. Keep the questions short and direct. Do not include any numbering, formatting, or extra text."
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            contents=initial_prompt
        )
        
        questions = response.text.strip().split('\n')
        return questions

    def analyze_websites(self, urls: List[str], domain: str) -> Dict[str, bool]:
        """Analyze multiple websites for productivity."""
        results = {}
        for url in urls:
            results[url] = self.analyze_website(url, domain)
        return results

app = Flask(__name__)
analyzer = ProductivityAnalyzer()

@app.route('/analyzeWebsite', methods=['POST'])
def analyze_website_endpoint():
    data = request.json
    url = data.get('url')
    domain = data.get('domain')
    is_productive = analyzer.analyze_website(url, domain)
    return jsonify({'isProductive': is_productive})

@app.route('/getQuestions', methods=['GET'])
def get_questions_endpoint():
    questions = analyzer.fetch_questions()
    return jsonify({'questions': questions})

@app.route('/contextualize', methods=['POST'])
def contextualize_endpoint():
    data = request.json
    domain = data.get('domain')
    analyzer.contextualize(domain)
    return jsonify({'contextData': analyzer.context_data})

if __name__ == "__main__":
    app.run(port=5000)
