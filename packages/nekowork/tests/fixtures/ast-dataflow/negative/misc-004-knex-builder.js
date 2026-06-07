// negative: knex query-builder chain (not .raw) — parameterized internally.
export function fetch(knex, status) {
  return knex("orders")
    .where("status", status)
    .andWhere("archived", false)
    .select("id", "total")
    .orderBy("created_at", "desc");
}
