// negative: benign CORS — explicit allow-list origin, no wildcard

import cors from "cors";

export const middleware = cors({
  origin: "https://app.example.com",
  credentials: true,
});

export function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://app.example.com");
  res.end("ok");
}
