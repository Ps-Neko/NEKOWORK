// negative: spawn with an argument array — no shell parsing (safe)
import { spawn } from "node:child_process";

export function listDir(dir) {
  return spawn("ls", ["-la", dir]);
}
