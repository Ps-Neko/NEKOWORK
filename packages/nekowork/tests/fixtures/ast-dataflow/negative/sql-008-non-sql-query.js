// negative: .query()/.execute() on NON-SQL strings (no DML keyword). A dynamic
// value flows in, but it is not a SQL sink — the SQL-keyword gate keeps it out.
export function metrics(emitter, name, runner, task) {
  const ev = "fetching " + name;
  emitter.query(ev);
  const job = "job:" + task;
  return runner.execute(job);
}
