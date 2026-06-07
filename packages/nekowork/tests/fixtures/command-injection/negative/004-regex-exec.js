// negative: RegExp.prototype.exec / parser.exec — not child_process exec
export function parse(input) {
  const m = /(\d+)/.exec(input);
  const r = parser.exec(input);
  return [m, r];
}
