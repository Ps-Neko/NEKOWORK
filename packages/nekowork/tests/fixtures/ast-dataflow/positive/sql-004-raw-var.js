// positive: knex.raw fed an assembled template literal via a variable.
export function rawLookup(knex, userId) {
  const stmt = `SELECT id, email FROM accounts WHERE id = ${userId}`;
  return knex.raw(stmt);
}
