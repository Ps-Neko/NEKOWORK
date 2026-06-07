// negative: spawn with a dynamic command but shell:false (explicit). Without a
// shell, the command is not re-parsed for metacharacters → not the injection
// shape this rule flags. (The cmd is the program name, args are separate.)
const { spawn } = require("child_process");
function run(program, dir) {
  return spawn(program, ["--cwd", dir], { shell: false });
}
module.exports = { run };
