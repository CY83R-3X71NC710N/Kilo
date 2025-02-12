import os
import json
import requests
from google import genai
from typing import Dict, List
from bs4 import BeautifulSoup

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
        """Ask questions to contextualize the task."""
        prompt = f"You are analyzing for {domain} domain. Ask relevant questions to understand the specific task. Reply with 'done' when you have enough information."
        while True:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            if response.text.lower() == "done":
                break
            # Store response in context_data
            self.context_data[response.text] = input(f"{response.text}: ")

    def analyze_website(self, url: str, domain: str) -> bool:
        """Analyze if a website is productive for the given domain and context."""
        try:
            response = requests.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            site_data = {
                "title": soup.title.string if soup.title else "",
                "content": soup.get_text()[:1000],  # First 1000 chars
                "domain": domain,
                "context": self.context_data,
                "settings": self.settings["domains"][domain]
            }
            
            prompt = f"Based on the following data, is this website productive for the task? {json.dumps(site_data)}"
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            return "yes" in response.text.lower()
        except Exception as e:
            print(f"Error analyzing website: {e}")
            return False

def main():
    analyzer = ProductivityAnalyzer()
    domain = input("Enter domain (work/school/personal): ").lower()
    
    if domain not in analyzer.settings["domains"]:
        print("Invalid domain")
        return
    
    analyzer.contextualize(domain)
    
    while True:
        url = input("Enter URL to analyze (or 'quit' to exit): ")
        if url.lower() == 'quit':
            break
        
        is_productive = analyzer.analyze_website(url, domain)
        print(f"Website is {'productive' if is_productive else 'not productive'} for your task.")

if __name__ == "__main__":
    main()
