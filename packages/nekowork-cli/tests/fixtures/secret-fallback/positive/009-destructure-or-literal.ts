// pattern: destructure 후 fallback
// const { API_KEY = "literal" } = process.env

export function loadConfig() {
  const { STRIPE_SECRET_KEY = "sk_test_fallback_xyz" } = process.env;
  return { stripeKey: STRIPE_SECRET_KEY };
}
