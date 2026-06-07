// negative: reflected origin from an allow-list (no wildcard) — secure pattern
const ALLOWED = new Set(["https://app.example.com", "https://www.example.com"]);
module.exports = function cors(req, res, next) {
  const origin = req.headers.origin;
  if (ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  next();
};
