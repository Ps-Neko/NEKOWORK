# positive: Python requests with verify=False
import requests


def fetch(url):
    return requests.get(url, verify=False)
