// negative: eval of a PURE literal expression bound to a constant variable.
// const-propagation: `code` is const-safe → NOT flagged (low signal; the regex
// eval-usage rule already ignores eval("literal")).
export function constMath() {
  const code = "1 + 2";
  return eval(code);
}
