# positive: Python subprocess.run with shell=True and an f-string command
import subprocess


def checkout(branch):
    subprocess.run(f"git checkout {branch}", shell=True)
