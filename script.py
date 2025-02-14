import os
import json
import requests
from google import genai
from typing import Dict, List
from bs4 import BeautifulSoup
from urllib.parse import urlparse

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

    def get_next_question(self, domain: str, context: Dict) -> str:
        """Get the next contextual question based on previous answers using AI."""
        try:
            # For first question, provide domain context only
            if not context:
                prompt = f"""As a productivity assistant, ask one focused question to understand the user's {domain} task.
                The question should help understand what specific activity they're working on.
                Do not ask about time or duration.
                Respond with only the question text, no additional formatting."""

                response = self.client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                return response.text.strip()

            # For subsequent questions, include previous context
            context_json = json.dumps(context, indent=2)
            prompt = f"""Based on this context about a {domain} task, ask one focused follow-up question.
            Previous Q&A:
            {context_json}

            Ask a question that builds upon this context to better understand:
            - Specific task goals and objectives
            - Required deliverables or outcomes
            - Success criteria
            - Task complexity or scope

            Important: Do not ask about time, duration, or scheduling.

            **You should respond with 'DONE' when you are confident you understand the user's main task, purpose and goals related to {domain}. Only respond with 'DONE' when you can accurately assess if a website is productive for this task based on the gathered context.  If you still need more clarity on any of these aspects to make a productivity assessment, ask one more focused question.  If you believe you have enough information, respond with exactly 'DONE'. Otherwise, respond with only your follow-up question, no additional text.**"""

            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )

            question = response.text.strip()

            # Check if AI thinks we have enough context
            if question.upper() == 'DONE':
                return 'DONE'

            return question

        except Exception as e:
            print(f"Error generating question: {e}")
            return "What are you trying to accomplish?"

    def contextualize(self, domain: str) -> None:
        """Ask focused questions one at a time to contextualize the task."""
        # Track conversation to maintain context
        conversation_history = []
        self.context_data = {} # Clear previous context data

        while True:
            question = self.get_next_question(domain, conversation_history)

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

    def _is_productive_domain(self, url: str, domain: str) -> bool:
        """Check if the domain is in the productive list."""
        base_domain = self._get_domain_from_url(url)
        settings = self.settings["domains"][domain]

        # Check if it's an explicitly allowed platform
        if self._is_allowed_platform(url, domain):
            return True

        # Check if it's in blocked specific list
        if "blocked_specific" in settings:
            for blocked in settings["blocked_specific"]:
                if base_domain.endswith(blocked):
                    return False

        return None  # None means needs further analysis

    def analyze_website(self, url: str, domain: str) -> bool:
        """Analyze if a website is productive for the given domain and context."""
        try:
            # Skip analysis for extension block page
            if 'chrome-extension://' in url and 'block.html' in url:
                return False

            # Quick check for productive/blocked domains
            is_productive = self._is_productive_domain(url, domain)
            if is_productive is not None:
                return is_productive

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
