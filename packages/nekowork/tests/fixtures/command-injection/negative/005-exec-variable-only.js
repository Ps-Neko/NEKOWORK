// negative: exec called with a single pre-validated variable (no inline concat
// or interpolation of input into the command string). Out of scope for this
// rule, which only flags the unambiguous interpolation-INTO-command shape.
import { exec } from "node:child_process";

export function runValidated(safeCommand) {
  exec(safeCommand);
}
