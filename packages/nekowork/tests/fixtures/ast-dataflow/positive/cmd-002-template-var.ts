// positive: template-literal command bound to a variable, then exec'd.
import { exec } from "node:child_process";

export function ping(host: string): void {
  const command: string = `ping -c 4 ${host}`;
  exec(command, (err, out) => {
    if (err) throw err;
    process.stdout.write(out);
  });
}
