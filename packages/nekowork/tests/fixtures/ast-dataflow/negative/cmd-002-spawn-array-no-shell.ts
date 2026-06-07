// negative: spawn with a static command + argument array, NO shell option.
// The dynamic value travels only through the args array (not shell-parsed).
import { spawn } from "node:child_process";

export function gitClone(repo: string) {
  return spawn("git", ["clone", repo], { stdio: "inherit" });
}
