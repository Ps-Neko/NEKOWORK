// positive: knex .raw() with interpolated input (bypasses the query builder)
export function recent(knex, userId) {
  return knex.raw(`SELECT * FROM events WHERE user_id = ${userId} ORDER BY ts DESC`);
}
