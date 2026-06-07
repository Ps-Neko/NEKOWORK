// positive (INTER-PROCEDURAL): the SQL string is assembled inside a LOCAL helper
// and the helper's result flows into db.query() in another function. The
// intraprocedural engine recovers NO text from the build(...) call, so the
// SQL-keyword gate kept it clean; the arg-sensitive return-taint resolver binds
// build's param `x` to the (dynamic) `req.id` and recovers the SELECT keyword.
function buildUserQuery(x) {
  return "SELECT * FROM users WHERE id = " + x;
}
export function getUser(db, req) {
  return db.query(buildUserQuery(req.params.id));
}
