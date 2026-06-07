// negative (INTER-PROCEDURAL FP guard): a local helper returns a CONSTANT SQL
// string with no parameter influence. The arg-sensitive resolver sees the return
// is not dynamic, so the cross-function path stays clean.
function buildQuery() {
  return "SELECT 1";
}
export function ping(db) {
  return db.query(buildQuery());
}
