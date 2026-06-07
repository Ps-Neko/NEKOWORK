// negative: a dynamic value is produced in one function and a sink lives in
// ANOTHER. The analyzer is strictly intraprocedural — it must NOT chase across
// functions (that is the #1 FP source). `db.query(sql)` here sees `sql` as a
// PARAMETER (dynamic), but the query string has no SQL keyword reachable inside
// this function, so the SQL-keyword gate keeps it clean.
function buildName(prefix, suffix) {
  return prefix + "-" + suffix;
}
export function label(db, sql) {
  const name = buildName("a", "b");
  return [name, db.query(sql)];
}
