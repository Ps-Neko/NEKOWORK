// negative (INTER-PROCEDURAL FP guard): a local helper builds a dynamic but
// NON-SQL string (an event topic) that flows into a generic `.query()` on an
// emitter. The dynamic flag is true, but the SQL-keyword gate finds no DML
// keyword in the recovered text ("topic-"), so it stays clean.
function buildTopic(x) {
  return "topic-" + x;
}
export function subscribe(emitter, req) {
  return emitter.query(buildTopic(req.id));
}
