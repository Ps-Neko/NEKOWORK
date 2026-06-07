// positive: eval of a string assembled from input across statements.
// Regex eval-usage flags eval(<non-literal>) on the call line; here the payload
// is built first and only a bare variable is passed to eval, which the regex
// treats as low-signal / does not assemble.
export function compute(userExpr) {
  const payload = "(" + userExpr + ")";
  return eval(payload);
}
