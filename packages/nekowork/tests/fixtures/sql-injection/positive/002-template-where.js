// positive: template-literal interpolation of a variable into a WHERE clause
export async function search(db, term) {
  return db.query(`SELECT id, name FROM products WHERE name LIKE '%${term}%'`);
}
