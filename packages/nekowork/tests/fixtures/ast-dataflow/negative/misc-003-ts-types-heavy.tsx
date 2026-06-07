// negative: TSX with heavy type annotations + generics. Exercises type
// stripping (offsets preserved). Static query bound to a typed const → safe.
interface Props<T> {
  rows: T[];
  db: { query(sql: string, params?: unknown[]): Promise<T[]> };
}

export async function load<T>({ db }: Props<T>, id: number): Promise<T[]> {
  const sql: string = "SELECT * FROM t WHERE id = $1";
  return db.query(sql, [id]);
}
