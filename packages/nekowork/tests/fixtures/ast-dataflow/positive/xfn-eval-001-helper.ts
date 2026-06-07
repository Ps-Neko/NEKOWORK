// positive (INTER-PROCEDURAL, TS): a local helper wraps user input in code text
// and the result is passed to eval(). The resolver binds `c` to the dynamic
// parameter and surfaces the dynamic flow into the eval sink across functions.
function assemble(c: string): string {
  return "(" + c + ")";
}
export function runExpr(input: string): unknown {
  return eval(assemble(input));
}
