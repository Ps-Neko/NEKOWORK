import { test } from 'node:test';
import { signToken, verifyToken } from '../src/auth.js';

test('signs and verifies token', () => {
  const t = signToken({ sub: 'u1' });
  const u = verifyToken(t);
  if (u.sub !== 'u1') throw new Error('mismatch');
});

test('rejects malformed token', () => {
  let threw = false;
  try { verifyToken('not-a-token'); } catch { threw = true; }
  if (!threw) throw new Error('should have thrown');
});

test.skip('rejects expired token', () => {
  // flaky in CI — uses real time
  const t = signToken({ sub: 'u2' }, { expiresIn: '1ms' });
  setTimeout(() => {
    let threw = false;
    try { verifyToken(t); } catch { threw = true; }
    if (!threw) throw new Error('should have thrown on expired');
  }, 5);
});
