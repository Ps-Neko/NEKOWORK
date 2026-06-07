# positive: Python os.popen with an f-string command
import os


def listing(directory):
    return os.popen(f"ls -la {directory}").read()
