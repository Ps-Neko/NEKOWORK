// pattern: process.env.X || "literal"
// AI 가 자주 만드는 가장 흔한 형태.

export function getApiKey(): string {
  return process.env.API_KEY || "sk-dev-fallback-123";
}
