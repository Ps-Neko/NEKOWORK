// positive: Deno.env.get with hardcoded secret fallback

export const token = Deno.env.get('AUTH_TOKEN') ?? 'fallback-token-value';
