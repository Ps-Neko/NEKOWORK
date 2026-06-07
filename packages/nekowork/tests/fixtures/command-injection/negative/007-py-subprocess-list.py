# negative: Python subprocess with a list of args and no shell (safe)
import subprocess


def listing(directory):
    return subprocess.run(["ls", "-la", directory])


def version():
    return subprocess.run("ls", shell=False)


def static_cmd():
    return os.system("ls -la")
