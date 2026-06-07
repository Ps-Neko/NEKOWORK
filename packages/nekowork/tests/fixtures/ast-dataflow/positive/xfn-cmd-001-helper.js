// positive (INTER-PROCEDURAL): a local helper assembles a shell command from its
// parameter; the helper's result flows into cp.execSync(). The arg-sensitive
// resolver binds `p` to the dynamic request value and reports the dynamic
// command — a cross-function OS-command-injection vector.
function makeCmd(p) {
  return "tar -xzf " + p;
}
export function extract(cp, req) {
  return cp.execSync(makeCmd(req.body.archive));
}
