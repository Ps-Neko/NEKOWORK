// negative: env-config constants + a setTimeout with a function reference.
// No assembled value flows into eval/exec/query.
const PORT = process.env.PORT || "3000";
const HOST = "0.0.0.0";

export function start(server) {
  const addr = HOST + ":" + PORT;
  setTimeout(() => server.listen(addr), 100);
  return addr;
}
