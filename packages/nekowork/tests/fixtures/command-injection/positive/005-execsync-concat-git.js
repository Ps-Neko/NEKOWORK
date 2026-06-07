// positive: execSync git command concatenating a branch name from input
import { execSync } from "node:child_process";

export function checkout(branch) {
  return execSync("git checkout " + branch).toString();
}
