// SQL-Injection rule for verify-pr.
//
// Flags a SQL string built by concatenating / interpolating a variable directly
// into the query text passed to query( / execute( / .raw( — the canonical
// SQL-injection vector AI agents introduce:
//   - db.query("SELECT * FROM users WHERE id = " + userId)
//   - db.query(`SELECT * FROM t WHERE x = ${req.body.x}`)
//   - conn.execute("DELETE FROM logs WHERE owner='" + name + "'")
//
// SAFE forms that must NOT fire (FP=0 against a diverse negative set):
//   - parameterized query: query("SELECT ... WHERE id = $1", [id])
//   - placeholder query:   query("SELECT ... WHERE id = ?", [id])
//   - fully static SQL:     query("SELECT 1")
//   - ORM / builder calls:  repo.find({ where: { id } }) / qb.where('id = :id')
//
// The gate that keeps FP low: the dynamic string must contain a SQL DML/DDL
// keyword (SELECT/INSERT/UPDATE/DELETE/...) AND mix in a concatenation or a
// ${...} interpolation. A query() call with a static string + params array is
// the safe shape and is explicitly excluded (no concat / no interpolation).
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
];

const SCANNER = makeRegexScanner({
  ruleName: 'sql-injection',
  category: 'sql-injection',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
