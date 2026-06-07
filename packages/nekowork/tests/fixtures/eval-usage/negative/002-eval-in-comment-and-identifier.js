// negative: the word eval only appears in comments, identifiers, and a method
// Do not use eval() here — see the lint rule no-eval below.

export function evaluateScore(items) {
  // medeval and retrieval are identifiers, not the eval builtin
  const retrieval = items.length;
  return obj.eval; // property access, not a call
}
