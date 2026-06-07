// negative (INTER-PROCEDURAL FP guard): the call site uses the canonical safe
// parameterized shape (placeholder string + params array). The helper `run`
// forwards a static SQL literal plus a params array; the OUTER call `run("SELECT
// ... $1", [req.id])` has a static first arg, so it never becomes dynamic.
function run(sql, params) {
  return db.query(sql, params);
}
export function getUser(req) {
  return run("SELECT * FROM users WHERE id = $1", [req.params.id]);
}
