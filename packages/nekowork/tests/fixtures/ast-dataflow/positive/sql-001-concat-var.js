// positive: SQL string built by concatenation in one statement, used in another.
// Regex sql-injection only matches `.query("...SQL..." + var)` on a SINGLE line;
// here the assembled string is bound to `q` first, so the line scanner misses it.
export async function getUser(db, req) {
  const id = req.params.id;
  const q = "SELECT * FROM users WHERE id = " + id;
  return db.query(q);
}
