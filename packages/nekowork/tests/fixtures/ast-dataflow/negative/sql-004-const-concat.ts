// negative: a SQL string built ONLY from constant string literals concatenated
// together (no variable). const-propagation: `+` of const-safe operands is
// const-safe → NOT flagged.
export function migration(db: Db): Promise<unknown> {
  const q: string = "CREATE TABLE " + "audit" + " (id INT PRIMARY KEY)";
  return db.query(q);
}
