// process.env.X || "" — the most common AI-generated env-fallback antipattern.
// Empty fallback silently turns a missing secret into "", enabling auth bypass
// and empty-JWT signing instead of a loud failure. Caught by env-or-empty-string.
const JWT_SECRET = process.env.JWT_SECRET || "";

export default JWT_SECRET;
