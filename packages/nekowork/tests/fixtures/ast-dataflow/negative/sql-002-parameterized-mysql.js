// negative: mysql2 parameterized query — ? placeholder + params array (safe).
// The query string is a static literal bound to a variable; the dynamic value
// only travels through the params array, never into the SQL text.
export async function find(conn, email) {
  const sql = "SELECT id FROM accounts WHERE email = ?";
  return conn.execute(sql, [email]);
}
