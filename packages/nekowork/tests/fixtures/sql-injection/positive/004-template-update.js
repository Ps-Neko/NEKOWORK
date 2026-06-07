// positive: UPDATE with two interpolated variables
export async function setBalance(pool, id, amt) {
  return pool.query(`UPDATE accounts SET balance = ${amt} WHERE id = ${id}`);
}
