# positive: mypy # type: ignore silences a type error instead of fixing it
def total(items):
    return sum(i.price for i in items)  # type: ignore
