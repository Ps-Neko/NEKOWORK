// positive: eval() of a template literal with interpolation

export function evalWith(name, value) {
  return eval(`${name} = ${value}`);
}
