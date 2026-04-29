#!/usr/bin/env node
// `harness wait --start` 영속 데몬.
// 동작:
//   - .harness/state/sessions/*/wakeup.json 폴링 (10초 간격).
//   - 발견 시 해당 세션의 ralph 또는 review 를 다시 시작.
//   - rate-limit / cost cap 시 1분 backoff.
// 데몬은 명시 시작 / 정지만. 자동 활성 안 함.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SESSIONS_DIR = path.join(ROOT, '.harness', 'state', 'sessions');
const PIDFILE = path.join(ROOT, '.harness', 'wait.pid');
const POLL_MS = Number(process.env.HARNESS_WAIT_POLL_MS || 10_000);

const verb = process.argv[2] || 'status';

if (verb === 'start') start();
else if (verb === 'stop') stop();
else if (verb === 'status') status();
else { console.error(`알 수 없는: ${verb}. start | stop | status`); process.exit(2); }

function start() {
  if (fs.existsSync(PIDFILE)) {
    const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
    if (alive(pid)) { console.error(`이미 실행 중: pid=${pid}`); process.exit(1); }
    fs.unlinkSync(PIDFILE);
  }
  fs.mkdirSync(path.dirname(PIDFILE), { recursive: true });
  fs.writeFileSync(PIDFILE, String(process.pid));
  console.log(`[harness wait] start pid=${process.pid} poll=${POLL_MS}ms`);

  const interval = setInterval(tick, POLL_MS);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  function cleanup() {
    clearInterval(interval);
    try { fs.unlinkSync(PIDFILE); } catch {}
    console.log('[harness wait] stop');
    process.exit(0);
  }
  // 첫 한 번 즉시 실행
  tick();
}

function stop() {
  if (!fs.existsSync(PIDFILE)) { console.log('(데몬 없음)'); return; }
  const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
  if (alive(pid)) {
    try { process.kill(pid, 'SIGTERM'); console.log(`SIGTERM pid=${pid}`); }
    catch (e) { console.error('kill 실패:', e.message); }
  } else {
    console.log(`stale pidfile (pid=${pid} 죽음). 정리.`);
  }
  try { fs.unlinkSync(PIDFILE); } catch {}
}

function status() {
  if (!fs.existsSync(PIDFILE)) { console.log('데몬 정지'); return; }
  const pid = Number(fs.readFileSync(PIDFILE, 'utf8'));
  console.log(`pid=${pid} alive=${alive(pid)}`);
  // wakeup pending 카운트
  let pending = 0;
  if (fs.existsSync(SESSIONS_DIR)) {
    for (const s of fs.readdirSync(SESSIONS_DIR)) {
      if (fs.existsSync(path.join(SESSIONS_DIR, s, 'wakeup.json'))) pending++;
    }
  }
  console.log(`pending wakeup: ${pending}`);
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function tick() {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  for (const s of fs.readdirSync(SESSIONS_DIR)) {
    const wakeup = path.join(SESSIONS_DIR, s, 'wakeup.json');
    if (!fs.existsSync(wakeup)) continue;
    const active = path.join(SESSIONS_DIR, s, 'active');
    if (!fs.existsSync(active)) {
      // active 가 없으면 ralph 가 끝난 것. wakeup 정리.
      try { fs.unlinkSync(wakeup); } catch {}
      continue;
    }
    if (fs.existsSync(path.join(SESSIONS_DIR, s, 'HUMAN_GATE'))) {
      console.log(`[wait] ${s}: HUMAN_GATE — skip`);
      continue;
    }
    console.log(`[wait] ${s}: wakeup 발견 → 재개 stub (Day 9 에 실 ralph 재호출 wiring)`);
    // Day 8 stub: wakeup 만 정리. 실 재개는 Day 9 GitHub Actions 통합 때 같이.
    try { fs.unlinkSync(wakeup); } catch {}
  }
}
