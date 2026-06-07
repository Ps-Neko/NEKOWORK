// negative (SINK-ALIAS FP guard): `const run = console.log` aliases a NON-sink.
// console.log is not a tracked sink method, so `run(...)` with a dynamic
// SQL-shaped string must NOT be treated as a sink and stays clean.
const run = console.log;
export function debug(req) {
  return run("SELECT " + req.query.x);
}
