// negative: test 코드에서 mock env 사용 (테스트 콘텍스트)

import { test } from "node:test";

test("respects API_KEY override", () => {
  process.env.API_KEY = "test-key-mock";
  // ...
});
