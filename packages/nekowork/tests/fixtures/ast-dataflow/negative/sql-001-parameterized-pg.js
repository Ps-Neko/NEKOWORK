// negative: pg parameterized query — $1 placeholder + params array (safe).
export async function getUser(db, id) {
  return db.query("SELECT * FROM users WHERE id = $1", [id]);
}
