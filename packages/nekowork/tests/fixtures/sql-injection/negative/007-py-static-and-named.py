# negative: Python static SQL + parameterized 2-arg + named-param forms (safe)
def get_one(cursor):
    cursor.execute("SELECT 1")


def get_user(cursor, uid):
    # 2-arg parameterized: the driver binds %s, not Python string formatting.
    cursor.execute("SELECT * FROM users WHERE id = %s", (uid,))


def get_named(cursor, uid):
    cursor.execute("SELECT * FROM users WHERE id = %(id)s", {"id": uid})
