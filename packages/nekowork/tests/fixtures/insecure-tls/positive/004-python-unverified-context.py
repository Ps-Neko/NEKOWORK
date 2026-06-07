# positive: Python ssl unverified context
import ssl
import urllib.request


def open_insecure(url):
    ctx = ssl._create_unverified_context()
    return urllib.request.urlopen(url, context=ctx)
