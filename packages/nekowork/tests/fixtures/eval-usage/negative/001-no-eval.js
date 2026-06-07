// negative: no dynamic execution — JSON.parse and a dispatch table

export function parse(input) {
  return JSON.parse(input);
}

const handlers = { add, sub };
export function dispatch(op, ...args) {
  return handlers[op](...args);
}
