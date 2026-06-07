# negative: Python subprocess running read-only git status (no push)
import subprocess


def check():
    result = subprocess.run(["git", "status", "--porcelain"], capture_output=True)
    return result.stdout.decode()
