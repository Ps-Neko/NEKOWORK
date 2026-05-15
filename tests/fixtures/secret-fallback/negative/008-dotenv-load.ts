// negative: dotenv 로 .env 파일 로드, hardcoded literal 없음

import "dotenv/config";

export const config = {
  apiKey: process.env.API_KEY,
  dbUrl: process.env.DATABASE_URL,
};
