// positive: function parameter (always dynamic) flows into exec via a temp var.
import { execSync } from "node:child_process";

export function gitLog(branch: string): Buffer {
  const c = "git log " + branch;
  return execSync(c);
}
