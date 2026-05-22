// pattern: process.env.X || `template-literal`
// AI 가 가끔 template literal 로 fallback 을 만든다.

export function getEndpoint(): string {
  const apiKey = process.env.SERVICE_API_KEY || `dev-key-${Date.now()}`;
  return `https://api.example.com?key=${apiKey}`;
}
