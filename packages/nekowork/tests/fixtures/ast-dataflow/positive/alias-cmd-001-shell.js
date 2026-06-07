// positive (SINK ALIAS): the shell sink is aliased to a local const, then the
// alias is called with a concatenated command. The intraprocedural engine only
// recognized `cp.execSync(...)` / bare `execSync(...)`; aliasing the sink to
// `run` bypassed it. Sink-alias resolution treats `run(...)` as execSync.
const cp = require('child_process');
const run = cp.execSync;
export function clean(req) {
  return run("rm -rf " + req.query.path);
}
