// positive: eval() of a concatenated / templated string

export function compute(expr) {
  return eval("return " + expr + ";");
}
