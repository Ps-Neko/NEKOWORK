# positive: Python %-format SQL passed to cursor.execute (NOT the 2-arg form)
def delete_user(cursor, name):
    cursor.execute("DELETE FROM users WHERE name = '%s'" % name)
