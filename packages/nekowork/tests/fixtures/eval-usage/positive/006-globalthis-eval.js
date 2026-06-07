// positive: indirect eval via globalThis.eval
export function exec(payload) {
  return globalThis.eval("(" + payload + ")");
}
