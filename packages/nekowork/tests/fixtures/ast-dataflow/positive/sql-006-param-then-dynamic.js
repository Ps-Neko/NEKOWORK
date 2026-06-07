// positive: looks parameterized at first glance, but the query string itself is
// dynamically assembled (the params array does not sanitize an injected column).
// No 2nd ArrayExpression on the .query() call → not parameterized; the SELECT is
// concatenated from a variable. Regex misses the cross-statement assembly.
export async function listSorted(db, sortColumn) {
  const order = "ORDER BY " + sortColumn;
  const q = "SELECT * FROM items " + order;
  return db.query(q);
}
