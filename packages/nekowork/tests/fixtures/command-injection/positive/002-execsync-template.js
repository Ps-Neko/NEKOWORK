// positive: execSync with a template-literal command interpolating a path
import { execSync } from "node:child_process";

export function removeDir(path) {
  execSync(`rm -rf ${path}`);
}
