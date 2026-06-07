# positive: Python INSERT built by concatenation passed to cursor.execute
def add_comment(cursor, text):
    cursor.execute("INSERT INTO comments (body) VALUES ('" + text + "')")
