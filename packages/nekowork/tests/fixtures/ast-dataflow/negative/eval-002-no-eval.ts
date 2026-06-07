// negative: dynamic strings everywhere, but they NEVER reach a dangerous sink.
// Pure data assembly + JSON.parse (the safe alternative to eval).
export function parseConfig(raw: string): unknown {
  const trimmed: string = raw.trim();
  const wrapped: string = "{" + trimmed + "}";
  return JSON.parse(wrapped);
}
