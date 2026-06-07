// positive: eval() of a runtime-built variable (injection vector)

export function runUserCode(input) {
  return eval(input);
}
