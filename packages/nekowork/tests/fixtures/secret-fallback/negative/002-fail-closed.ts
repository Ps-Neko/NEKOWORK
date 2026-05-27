// negative: missing 시 fail-closed

export function loadOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY must be set in production");
  }
  return key;
}
