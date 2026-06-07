# positive: Python os.getenv with hardcoded secret fallback
import os


def jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "dev-secret-do-not-use")
