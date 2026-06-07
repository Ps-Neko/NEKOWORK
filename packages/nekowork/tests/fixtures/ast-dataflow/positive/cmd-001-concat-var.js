// positive: command string concatenated in one statement, exec'd in another.
const cp = require("child_process");
function listDir(userPath) {
  const cmd = "ls -la " + userPath;
  return cp.execSync(cmd);
}
module.exports = { listDir };
