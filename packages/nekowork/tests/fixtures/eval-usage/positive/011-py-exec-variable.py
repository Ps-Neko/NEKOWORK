# positive: Python exec() on a variable / assembled code string
def run_user_code(code):
    exec(code)


def run_assignment(name, value):
    exec(f"{name} = {value}")
