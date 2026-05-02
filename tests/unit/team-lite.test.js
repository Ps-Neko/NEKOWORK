import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { teamLiteCycle } from '../../scripts/orchestrators/team-lite.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('team-lite writes staged task, heartbeat, monitor, and handoffs', async () => {
  const r = await teamLiteCycle({
    task: '문서 정리',
    sessionId: 'unit-team-lite',
    harnessRoot: ROOT,
  });

  assert.equal(r.sessionId, 'unit-team-lite');
  assert.ok(r.tasks.find(t => t.id === 'team-plan'));
  assert.ok(r.tasks.find(t => t.id === 'team-verify'));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'team-lite.json')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'heartbeat.json')));
  assert.ok(fs.existsSync(path.join(r.sessionDir, 'monitor.json')));

  const handoffDir = path.join(r.sessionDir, 'handoffs');
  const files = fs.readdirSync(handoffDir);
  assert.ok(files.some(f => f.includes('team-plan') && f.endsWith('.md')));
  assert.ok(files.some(f => f.includes('team-verify') && f.endsWith('.json')));
});
