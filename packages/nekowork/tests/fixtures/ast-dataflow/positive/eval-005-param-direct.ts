// positive: a function parameter (dynamic) reassigned then eval'd.
export function evalConfig(raw: string): unknown {
  let code = raw;
  code = "(" + code + ")";
  return eval(code);
}
