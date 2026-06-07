// negative: non-secret env var (PORT) falling back to a value — not a secret leak
export const port = process.env.PORT || defaultPort;
export const host = process.env.HOST || (isDev ? "localhost" : "0.0.0.0");
