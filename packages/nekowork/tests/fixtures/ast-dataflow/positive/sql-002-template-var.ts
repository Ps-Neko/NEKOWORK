// positive: template literal with ${} bound to a variable, then executed.
// Regex sql-template only fires when the template is the direct call argument.
export async function search(db: Db, req: Req): Promise<unknown> {
  const term: string = req.query.term;
  const sql: string = `SELECT * FROM products WHERE name LIKE '%${term}%'`;
  return await db.execute(sql);
}
