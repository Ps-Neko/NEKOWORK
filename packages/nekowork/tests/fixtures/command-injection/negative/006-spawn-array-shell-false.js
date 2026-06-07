// negative: spawn with array args and shell:false explicitly (safe)
import { spawn } from "node:child_process";

export function backup(src, dest) {
  return spawn("rsync", ["-a", src, dest], { shell: false });
}
