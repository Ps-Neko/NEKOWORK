// positive: exec building a tar command from a concatenated filename
import { exec } from "node:child_process";

export function archive(name) {
  exec("tar czf " + name + ".tgz ./data");
}
