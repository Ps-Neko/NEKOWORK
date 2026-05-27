// NEGATIVE: empty-string fallback on a NON-secret env name.
// The env-or-empty-string pattern is intentionally scoped to env names
// that contain a secret keyword (KEY/TOKEN/SECRET/PASS/AUTH/JWT/API/...).
// NODE_ENV / PORT / LOG_LEVEL etc. must NOT fire.
const env = process.env.NODE_ENV || "";
const port = process.env.PORT || "";
const logLevel = process.env.LOG_LEVEL || "";

export { env, port, logLevel };
