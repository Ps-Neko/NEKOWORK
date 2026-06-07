// positive: Node https agent with TLS verification disabled
import https from "node:https";

export const agent = new https.Agent({
  rejectUnauthorized: false,
});
