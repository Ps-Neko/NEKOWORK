// positive: DELETE assembled with concatenation, embedded single quotes
export async function purge(conn, owner) {
  await conn.execute("DELETE FROM logs WHERE owner='" + owner + "'");
}
