// positive: new Function with multiple args, body assembled from input.
export function build(op, operand) {
  const expr = "a " + op + " " + operand;
  return new Function("a", "return " + expr);
}
