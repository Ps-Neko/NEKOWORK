// pattern: env 변수 이름이 SECRET / TOKEN / KEY 가 아니어도 secret 인 경우
// (jwt sign 콘텍스트로 의도 추정 가능)

import { sign } from "jsonwebtoken";

export function issueToken(userId: string) {
  const secret = process.env.JWT_SIGNING_SECRET || "dev-jwt-secret";
  return sign({ userId }, secret);
}
