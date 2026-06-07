// negative: fail-closed guard expression after || (throw) is NOT a fallback
export const apiKey =
  process.env.API_KEY || (() => { throw new Error("API_KEY is required"); })();
