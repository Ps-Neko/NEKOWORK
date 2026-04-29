#!/usr/bin/env node
// Stop persistent-mode.
// .harness/state/sessions/<id>/active 가 있으면 wakeup.json drop.
// Day 3 stub. 실 데몬 (harness wait --start) 은 Day 6 이후.

import fs from 'node:fs';
import path from 'node:path';

if (process.env.HARNESS_HOOK_PERSISTENT_MODE === '0') process.exit(0);

const sessionId = process.env.HARNESS_SESSION_ID || 'default';
const sessionDir = path.join('.harness', 'state', 'sessions', sessionId);
const activeFlag = path.join(sessionDir, 'active');

if (!fs.existsSync(activeFlag)) process.exit(0);

const wakeup = path.join(sessionDir, 'wakeup.json');
const payload = {
  session_id: sessionId,
  scheduled_at: new Date().toISOString(),
  reason: 'Stop hook detected active flag',
};
fs.writeFileSync(wakeup, JSON.stringify(payload, null, 2));
process.stderr.write(`[persistent-mode] wakeup signal: ${wakeup}\n`);
process.stderr.write('[persistent-mode] The boulder never stops (Day 6 데몬 활성 시 자동 재개)\n');

process.exit(0);
