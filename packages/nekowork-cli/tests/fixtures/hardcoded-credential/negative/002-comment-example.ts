// negative: comment that mentions a fake key in docs
//   Example: AKIAIOSFODNN7EXAMPLE — example only, never commit a real one.
// Code must use env vars instead.

export const KEY = process.env.AWS_ACCESS_KEY_ID;
