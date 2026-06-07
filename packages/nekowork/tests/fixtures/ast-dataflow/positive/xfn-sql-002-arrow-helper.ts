// positive (INTER-PROCEDURAL, arrow helper, TS): a const arrow function builds a
// SQL fragment from its argument; its return flows into conn.query(). The
// resolver handles an ArrowFunctionExpression with an expression body and binds
// the param `s` to the dynamic call argument.
const wrapSelect = (s: string): string => "SELECT " + s + " FROM accounts";
export function listAccounts(conn: { query: (q: string) => unknown }, req: { col: string }) {
  return conn.query(wrapSelect(req.col));
}
