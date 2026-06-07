// positive: raw wildcard CORS header (medium — wildcard alone)

export function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end("ok");
}
