// positive: spawn with shell:true and a template-interpolated command (RCE)
import { spawn } from "node:child_process";

export function run(cmd) {
  return spawn(`sh -c ${cmd}`, { shell: true });
}
