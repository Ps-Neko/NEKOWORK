// negative: exec/execSync with a fully static literal command (safe)
import { exec, execSync } from "node:child_process";

export function info() {
  exec("uname -a");
  return execSync(`node --version`).toString();
}
