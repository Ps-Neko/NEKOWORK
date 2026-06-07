# positive: Python os.environ.get with hardcoded secret fallback
import os

API_KEY = os.environ.get("OPENAI_API_KEY", "sk-fallback-placeholder-value")
