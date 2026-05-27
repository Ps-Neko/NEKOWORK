// pattern: config.apiKey || "literal"

import { config } from "./config";

export function client() {
  const key = config.apiKey || "hardcoded-fallback-key";
  return { key };
}
