// positive: new Function() with a dynamically-assembled body string.
export function makeFn(expr) {
  const body = "return " + expr + ";";
  return new Function("x", body);
}
