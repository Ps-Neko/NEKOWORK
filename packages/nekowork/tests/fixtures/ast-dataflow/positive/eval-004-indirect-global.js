// positive: indirect global eval of an assembled string via a variable.
export function runGlobal(src) {
  const wrapped = "var z = " + src + ";";
  return globalThis.eval(wrapped);
}
