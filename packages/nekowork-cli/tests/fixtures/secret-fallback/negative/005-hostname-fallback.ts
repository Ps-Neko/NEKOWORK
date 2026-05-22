// negative: hostname fallback (secret 아님)

export function getRedisHost(): string {
  return process.env.REDIS_HOST || "localhost";
}
