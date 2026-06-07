// negative (INTER-PROCEDURAL FP guard): a numeric helper called with constants,
// result logged. No sink, no SQL keyword, no dynamic string flow — the resolver
// must not manufacture a finding from arithmetic helpers.
function add(a, b) {
  return a + b;
}
export function total() {
  const x = add(1, 2);
  return console.log(x);
}
