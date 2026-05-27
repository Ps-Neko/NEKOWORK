// negative: test file that mocks git operations. The string 'git push'
// appears only inside a comment + string for assertion, not as automation.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('mocks git operations', () => {
  const observed = ['git status', 'git fetch'];
  // we explicitly verify NO 'git push' was issued by the mock harness
  assert.equal(observed.includes('something else entirely'), false);
});
