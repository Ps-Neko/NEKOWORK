# positive: Python os.system with a concatenated command
import os


def cleanup(path):
    os.system("rm -rf " + path)
