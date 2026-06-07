// negative: ? placeholder + params array (mysql2 style, safe)
export async function getOrder(conn, orderId) {
  return conn.execute("SELECT * FROM orders WHERE id = ?", [orderId]);
}
