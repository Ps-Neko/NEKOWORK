// positive: spawn with shell:true AND a dynamically-assembled command string.
// Array-arg spawn is safe, but shell:true re-enables shell parsing, so the
// concatenated command is injectable. The command is built in a prior statement.
const { spawn } = require("child_process");
function run(repo) {
  const cmd = "git clone " + repo;
  return spawn(cmd, { shell: true });
}
module.exports = { run };
