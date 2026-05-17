import requests
import json


class OllamaClient:
    def __init__(self, model_name="qwen2.5:1.5b-instruct", base_url="http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url
        self.generate_url = f"{base_url}/api/generate"

    def generate_response(self, user_message, system_prompt=None):
        if system_prompt:
            prompt = f"{system_prompt}\n\nUser: {user_message}\n\nAVA:"
        else:
            prompt = f"User: {user_message}\n\nAVA:"

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "keep_alive": -1,
            "options": {
                "temperature": 0.7,
                "num_predict": 150
            }
        }

        try:
            response = requests.post(
                self.generate_url,
                json=payload,
                timeout=300
            )
            response.raise_for_status()

            result = response.json()
            return result.get('response', '').strip()

        except requests.exceptions.RequestException as e:
            return f"[AVA system error: Unable to generate response - {str(e)}]"
        except Exception as e:
            return f"[AVA system error: {str(e)}]"

    def check_health(self):
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()

            tags = response.json()
            models = [m['name'] for m in tags.get('models', [])]

            return self.model_name in models

        except Exception:
            return False
