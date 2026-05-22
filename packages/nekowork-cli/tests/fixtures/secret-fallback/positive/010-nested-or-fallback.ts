// pattern: 중첩 || 체인의 마지막이 literal
// process.env.PRIMARY || process.env.SECONDARY || "literal"

export function getServiceKey(): string {
  return (
    process.env.SERVICE_KEY_PRIMARY ||
    process.env.SERVICE_KEY_SECONDARY ||
    "fallback-service-secret"
  );
}
