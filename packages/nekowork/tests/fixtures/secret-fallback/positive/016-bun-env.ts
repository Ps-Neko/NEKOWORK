// positive: Bun.env with hardcoded secret fallback

export const secret = Bun.env.SESSION_SECRET || 'dev-session-secret-123';
