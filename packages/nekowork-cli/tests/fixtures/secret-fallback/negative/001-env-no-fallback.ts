// negative: env 만 사용, fallback 없음

export function getApiKey(): string {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY is required");
  return key;
}
