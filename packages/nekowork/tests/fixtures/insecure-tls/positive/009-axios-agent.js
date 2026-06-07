// positive: axios with an https agent that disables TLS verification
import axios from "axios";
import https from "node:https";

export const client = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});
