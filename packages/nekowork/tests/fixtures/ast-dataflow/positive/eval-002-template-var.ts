// positive: eval of a template literal bound to a variable.
export function dispatch(name: string): unknown {
  const code: string = `handlers.${name}()`;
  return eval(code);
}
