// positive: UPDATE with two interpolated params, assembled then executed.
export async function rename(db: Db, id: number, name: string) {
  const query: string = `UPDATE users SET name = '${name}' WHERE id = ${id}`;
  return db.query(query);
}
