// positive: cors middleware with wildcard origin + credentials (high)

import cors from "cors";

export const middleware = cors({
  origin: "*",
  credentials: true,
});
