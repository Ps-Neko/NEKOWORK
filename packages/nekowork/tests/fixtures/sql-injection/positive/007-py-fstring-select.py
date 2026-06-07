# positive: Python f-string SQL interpolated into cursor.execute
def get_user(cursor, uid):
    cursor.execute(f"SELECT * FROM users WHERE id = {uid}")
    return cursor.fetchone()
