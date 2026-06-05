// pattern: let key = process.env.X; if (!key) key = "literal"

export function loadToken(): string {
  let token = process.env.AUTH_TOKEN;
  if (!token) token = "fallback-token-abc";
  return token;
}
