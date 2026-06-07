// negative: fully static SQL, no interpolation or concatenation (safe)
export async function ping(db) {
  return db.query("SELECT 1");
}

export async function activeUsers(db) {
  return db.query(`SELECT id, name FROM users WHERE active = true`);
}
