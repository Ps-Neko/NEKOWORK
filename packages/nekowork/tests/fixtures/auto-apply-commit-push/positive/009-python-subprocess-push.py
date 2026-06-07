# positive: Python subprocess git push (auto-push bypassing human approval)
import subprocess


def deploy():
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-m", "auto"])
    subprocess.run(["git", "push", "origin", "main"], check=True)
