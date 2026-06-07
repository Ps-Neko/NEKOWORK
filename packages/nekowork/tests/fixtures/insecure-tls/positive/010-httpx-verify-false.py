# positive: httpx client with verify=False (skips cert validation)
import httpx


def fetch(url):
    with httpx.Client(verify=False) as client:
        return client.get(url).json()
