// negative (INTER-PROCEDURAL FP guard): an identity helper is called with a
// CONSTANT argument. Binding the param to a non-dynamic constant means the
// resolved return is non-dynamic, so even though a SQL keyword is present the
// dynamic check fails and it stays clean (the tricky FP-safety case).
function identity(x) {
  return x;
}
export function ping(db) {
  return db.query(identity("SELECT 1"));
}
