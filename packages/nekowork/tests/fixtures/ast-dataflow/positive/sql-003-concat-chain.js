// positive: multi-part concat chain assembled across statements.
export async function deleteOwned(conn, owner, table) {
  const base = "DELETE FROM logs WHERE owner = '";
  const where = base + owner + "'";
  return conn.execute(where);
}
