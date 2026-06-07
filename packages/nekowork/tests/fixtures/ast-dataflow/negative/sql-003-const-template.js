// negative: THE PROTOTYPE FP. A constant template literal bound to a variable,
// then passed to query(). Const-propagation must classify `q` as CONST-SAFE
// (a TemplateLiteral with zero expressions) → NOT flagged.
export function ping(db) {
  const q = `SELECT 1`;
  return db.query(q);
}
