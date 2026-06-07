// positive: SELECT built by string concatenation of request input
export async function getUser(db, req) {
  return db.query("SELECT * FROM users WHERE id = " + req.params.id);
}
