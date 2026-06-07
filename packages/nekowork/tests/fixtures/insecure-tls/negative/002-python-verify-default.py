# negative: Python requests with verification on (default) and explicit CA
import requests


def fetch(url):
    return requests.get(url, verify="/etc/ssl/certs/ca-bundle.pem")


def fetch_default(url):
    return requests.get(url, verify=True)
