// pattern: process.env.X ?? "literal"

export function getOpenAIKey(): string {
  return process.env.OPENAI_API_KEY ?? "sk-test-default";
}
