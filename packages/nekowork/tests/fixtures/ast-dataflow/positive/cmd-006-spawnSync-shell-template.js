// positive: spawnSync with shell:true and a template-literal command via a var.
const { spawnSync } = require("child_process");
function remove(target) {
  const cmd = `rm -rf ${target}`;
  return spawnSync(cmd, { shell: true });
}
module.exports = { remove };
