// negative: 주석에 fallback 패턴이 적혀있지만 실제 코드는 아님

/**
 * NEVER do this:
 *   const key = process.env.API_KEY || "fallback-secret";
 * Instead, throw if the env var is missing.
 */
export function getKey(): string {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY missing");
  return key;
}
