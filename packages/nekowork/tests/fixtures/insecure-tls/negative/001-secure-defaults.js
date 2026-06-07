// negative: secure TLS — verification left on, custom CA trusted
import https from "node:https";
import fs from "node:fs";

export const agent = new https.Agent({
  rejectUnauthorized: true,
  ca: fs.readFileSync("./ca-bundle.pem"),
});
