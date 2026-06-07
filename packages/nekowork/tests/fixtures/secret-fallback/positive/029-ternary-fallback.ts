// positive: parenthesized ternary fallback for a secret-like env var
export function loadKey(cond) {
  return process.env.API_KEY || (cond ? "primary-key" : "secondary-key");
}
