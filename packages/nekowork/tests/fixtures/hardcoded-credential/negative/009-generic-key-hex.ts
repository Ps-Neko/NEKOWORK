// negative: `key-<32hex>` slugs that are NOT Mailgun credentials.
// A generic cache key / content hash / identifier has the same shape as a
// Mailgun API key, so the rule must context-gate on a mailgun/mg marker.
export const cacheKey = "key-0123456789abcdef0123456789abcdef";
export const contentHash = "key-fedcba9876543210fedcba9876543210";
const requestId = "key-11111111222222223333333344444444";
