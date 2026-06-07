// negative: exec/execSync of a fully STATIC command (constant string), bound to
// a variable. const-propagation: `cmd` is const-safe → NOT flagged.
const { exec, execSync } = require("child_process");
function status() {
  const cmd = "git status --porcelain";
  exec(cmd);
  return execSync("node --version");
}
module.exports = { status };
