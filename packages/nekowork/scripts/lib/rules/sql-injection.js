// SQL-Injection rule for verify-pr.
//
// Flags a SQL string built by concatenating / interpolating a variable directly
// into the query text passed to query( / execute( / .raw( — the canonical
// SQL-injection vector AI agents introduce:
//   - db.query("SELECT * FROM users WHERE id = " + userId)
//   - db.query(`SELECT * FROM t WHERE x = ${req.body.x}`)
//   - conn.execute("DELETE FROM logs WHERE owner='" + name + "'")
//   - cursor.execute(f"SELECT * FROM users WHERE id = {uid}")   (Python f-string)
//   - cur.execute("DELETE FROM t WHERE id = " + uid)            (Python concat)
//   - cursor.execute("SELECT ... %s" % uid)                     (Python %-format)
//
// SAFE forms that must NOT fire (FP=0 against a diverse negative set):
//   - parameterized query: query("SELECT ... WHERE id = $1", [id])
//   - placeholder query:   query("SELECT ... WHERE id = ?", [id])
//   - fully static SQL:     query("SELECT 1")
//   - ORM / builder calls:  repo.find({ where: { id } }) / qb.where('id = :id')
//   - Python parameterized: cursor.execute("SELECT ... %s", (id,))  (2-arg form)
//
// The gate that keeps FP low: the dynamic string must contain a SQL DML/DDL
// keyword (SELECT/INSERT/UPDATE/DELETE/...) AND mix in a concatenation or a
// ${...} / f-string interpolation / %-format. A query() call with a static
// string + params array is the safe shape and is explicitly excluded (no
// concat / no interpolation). The Python %-format pattern requires the `%` to
// be a string-format operator (literal `%` operand), NOT the safe 2-arg
// `.execute(sql, params)` call where params follow a comma.
//
// Severity: high.

import { makeRegexScanner } from './_helpers.js';

// SQL keyword that must appear inside the assembled string for it to count as a
// query (avoids matching arbitrary `.query("config " + x)` style calls).
const SQL_KW = '(?:SELECT|INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|REPLACE\\s+INTO|MERGE|UNION|DROP\\s+TABLE|ALTER\\s+TABLE|TRUNCATE|FROM|WHERE)';

// Sink methods that execute raw SQL.
const SINK = '(?:query|execute|exec|raw)';

const PATTERNS = [
  {
    // Concatenation form: query("... SQL ... " + var ...). The literal must
    // contain a SQL keyword and be followed by `" +` (variable concatenation).
    // The string body uses a backreferenced delimiter and a negated class for
    // ONLY that delimiter (`[^\\1...]` is not possible, so we branch on the
    // quote char), letting the OTHER quote appear inside, e.g.
    //   conn.execute("DELETE FROM logs WHERE owner='" + name + "'")
    //   client.query('INSERT INTO t VALUES ("' + a + '")')
    id: 'sql-concat',
    re: new RegExp(`\\.${SINK}\\s*\\(\\s*(?:"[^"\\n]*${SQL_KW}[^"\\n]*"|'[^'\\n]*${SQL_KW}[^'\\n]*')\\s*\\+`, 'gi'),
    severity: 'high',
    title: 'SQL string built by concatenation',
    description: 'A SQL query string is assembled with + concatenation of a variable and passed to query/execute/raw — a SQL-injection vector.',
    recommendation: 'Use parameterized queries (placeholders + a params array), not string concatenation.',
  },
  {
    // Template-interpolation form: query(`... SQL ... ${var} ...`).
    //   db.query(`SELECT * FROM t WHERE x = ${req.body.x}`)
    id: 'sql-template',
    re: new RegExp(`\\.${SINK}\\s*\\(\\s*\`[^\`]*${SQL_KW}[^\`]*\\$\\{[^}]+\\}`, 'gi'),
    severity: 'high',
    title: 'SQL string built by template interpolation',
    description: 'A SQL query template literal interpolates a variable with ${...} and is passed to query/execute/raw — a SQL-injection vector.',
    recommendation: 'Use parameterized queries (placeholders + a params array), not template interpolation.',
  },
  {
    // Python f-string SQL: cursor.execute(f"SELECT ... {x} ...").
    // The f-string must contain a SQL keyword AND a {..} interpolation. The
    // safe Python 2-arg form (cursor.execute("SELECT ... %s", (id,))) uses a
    // plain string literal (no `f` prefix, no {..}) and never matches.
    //   cursor.execute(f"SELECT * FROM users WHERE id = {uid}")
    //   cur.execute(f'DELETE FROM t WHERE name = {name}')
    id: 'sql-py-fstring',
    re: new RegExp(`\\.${SINK}\\s*\\(\\s*f(?:"[^"\\n]*${SQL_KW}[^"\\n]*\\{[^}]+\\}|'[^'\\n]*${SQL_KW}[^'\\n]*\\{[^}]+\\})`, 'gi'),
    severity: 'high',
    title: 'SQL string built by Python f-string interpolation',
    description: 'A Python f-string SQL query interpolates a variable with {..} and is passed to cursor.execute — a SQL-injection vector.',
    recommendation: 'Use a parameterized query: cursor.execute("SELECT ... WHERE id = %s", (id,)). Never build SQL with an f-string.',
  },
  {
    // Python %-format SQL: cursor.execute("SELECT ... %s ..." % x). The string
    // literal contains a SQL keyword and is followed by a `%` FORMAT operator
    // (string-format), distinct from the safe 2-arg `.execute(sql, params)`
    // where params follow a COMMA. We require the literal to be immediately
    // followed by `%` and then a non-`)` operand (a variable / tuple), so a
    // literal that simply ends the call does not match.
    //   cursor.execute("SELECT * FROM users WHERE id = %s" % uid)
    //   cur.execute("DELETE FROM t WHERE name = '%s'" % (name,))
    id: 'sql-py-percent',
    re: new RegExp(`\\.${SINK}\\s*\\(\\s*(?:"[^"\\n]*${SQL_KW}[^"\\n]*"|'[^'\\n]*${SQL_KW}[^'\\n]*')\\s*%\\s*(?![\\s)])`, 'gi'),
    severity: 'high',
    title: 'SQL string built by Python %-format',
    description: 'A Python SQL query is assembled with the %-format operator (string % value) and passed to cursor.execute — a SQL-injection vector. This is NOT the safe 2-arg execute(sql, params) form.',
    recommendation: 'Use the 2-argument parameterized form: cursor.execute("SELECT ... %s", (id,)) where the driver binds the params — not Python string formatting.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'sql-injection',
  category: 'sql-injection',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
