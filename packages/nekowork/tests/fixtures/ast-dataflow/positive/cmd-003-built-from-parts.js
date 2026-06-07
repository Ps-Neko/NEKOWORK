// positive: command assembled from multiple parts across statements.
const { execSync } = require("child_process");
function archive(name, dest) {
  const flags = "-czf ";
  const cmd = "tar " + flags + dest + " " + name;
  execSync(cmd);
}
module.exports = { archive };
