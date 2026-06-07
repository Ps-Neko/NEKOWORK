# negative: Python parameterized query with %s placeholders + params tuple
def add_comment(cursor, text):
    cursor.execute("INSERT INTO comments (body) VALUES (%s)", (text,))
