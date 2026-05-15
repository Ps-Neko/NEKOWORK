// pattern: config.fallback.key  (구조적 fallback 의 명시적 접근)

import { config } from "./config";

export function resolveKey(): string {
  return config.apiKey || config.fallback.key;
}
