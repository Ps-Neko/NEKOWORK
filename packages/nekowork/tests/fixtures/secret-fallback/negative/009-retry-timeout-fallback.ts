// negative: retry count / timeout 같은 non-secret 숫자 fallback

export function clientOptions() {
  return {
    retries: Number(process.env.MAX_RETRIES || 3),
    timeoutMs: Number(process.env.TIMEOUT_MS || 5000),
  };
}
