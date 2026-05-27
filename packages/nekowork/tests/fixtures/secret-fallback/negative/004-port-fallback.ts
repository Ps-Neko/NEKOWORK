// negative: fallback 은 있지만 secret 이 아닌 port

export function getPort(): number {
  return Number(process.env.PORT || 3000);
}
