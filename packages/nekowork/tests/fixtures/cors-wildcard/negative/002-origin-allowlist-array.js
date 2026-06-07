// negative: cors with an array allow-list and a reflecting function — no '*'

import cors from "cors";

const allowed = ["https://a.example.com", "https://b.example.com"];

export const middleware = cors({
  origin: (origin, cb) => cb(null, allowed.includes(origin)),
  credentials: true,
});
