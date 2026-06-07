// positive (SINK ALIAS): the SQL sink is aliased to a local const, then the alias
// is called with an assembled SQL string. `const q = db.query` then `q("SELECT
// ..." + input)` evaded the member-sink matcher; sink-alias resolution applies
// the same dynamic + SQL-keyword + parameterized guards to `q(...)`.
const q = db.query;
export function find(req) {
  return q("SELECT * FROM tokens WHERE name = '" + req.body.name + "'");
}
