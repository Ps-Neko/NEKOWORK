// negative: eval of a pure static string literal (low signal, filtered)

export function warmup() {
  return eval("1 + 1");
}
