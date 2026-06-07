// negative: axios with default (secure) TLS — no verification disabled
import axios from "axios";

export const client = axios.create({
  baseURL: "https://api.example.com",
  timeout: 5000,
});
