// positive: secret-like env var falling back to a variable / function value
export const token = process.env.AUTH_TOKEN || defaultToken;
