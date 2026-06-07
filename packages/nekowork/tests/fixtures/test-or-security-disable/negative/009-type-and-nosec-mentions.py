# negative: prose mentions of "type" and identifiers that LOOK like nosec but
# are not suppression directives. None of these disable a check.
def parse(value):
    # this function checks the type of value properly and validates it
    nosecond = value.split(":")[0]   # variable named nosecond, not #nosec
    return {"type": "ok", "head": nosecond}
