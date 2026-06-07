# negative: Python getenv with non-secret numeric default (port)
import os

PORT = int(os.getenv("PORT", "8080"))
HOST = os.environ.get("HOST", "localhost")
