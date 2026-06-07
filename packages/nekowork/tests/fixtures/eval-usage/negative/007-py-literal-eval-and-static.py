# negative: Python safe alternatives — ast.literal_eval + static literals
import ast


def parse_data(raw):
    # The SAFE alternative: literal_eval only parses literals, never code.
    return ast.literal_eval(raw)


def constant():
    # Pure static literal — low signal, must not fire.
    return eval("1 + 1")


def static_exec():
    exec("pass")
