// Single-quote empty-string variant. AI tools mix '' and "" interchangeably.
const apiKey = process.env.OPENAI_API_KEY || '';

export function client() {
  return { apiKey };
}
