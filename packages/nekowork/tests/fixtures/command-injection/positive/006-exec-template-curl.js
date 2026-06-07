// positive: exec template-literal command interpolating a URL argument
import { exec } from "node:child_process";

export function fetch(url) {
  exec(`curl -fsSL ${url} -o /tmp/out`);
}
