// negative: execFile with a fixed binary + args array (safe)
import { execFile, spawnSync } from "node:child_process";

export function gitStatus() {
  execFile("git", ["status", "--porcelain"]);
  spawnSync("node", ["build.js", "--prod"]);
}
