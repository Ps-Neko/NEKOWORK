import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. Requests will fail.');
}

export const openai = new OpenAI({ apiKey });

export async function ask(prompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? '';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await ask(process.argv[2] ?? 'say hi in one word');
  console.log(out);
}
