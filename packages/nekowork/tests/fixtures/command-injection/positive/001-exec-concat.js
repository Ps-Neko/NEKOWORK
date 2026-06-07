// positive: exec runs a command string built by concatenation of user input
import { exec } from "node:child_process";

export function ping(host, cb) {
  exec("ping -c 1 " + host, cb);
}
