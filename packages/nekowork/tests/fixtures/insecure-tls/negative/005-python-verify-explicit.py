# negative: requests/httpx with explicit verification (secure)
import requests
import httpx


def fetch(url):
    requests.get(url, verify=True)
    with httpx.Client(verify="/etc/ssl/ca.pem") as c:
        return c.get(url)
