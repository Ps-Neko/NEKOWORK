// negative: execFile with an argument array — no shell, no injection.
const { execFile } = require("child_process");
function listDir(dir) {
  execFile("ls", ["-la", dir], (err, stdout) => {
    if (err) throw err;
    process.stdout.write(stdout);
  });
}
module.exports = { listDir };
