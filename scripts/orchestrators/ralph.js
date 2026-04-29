// ralph 영속 루프. PRD AC 가 모두 PASS 될 때까지 review 사이클 반복.
// 명시 호출 전용. 매직 키워드 자동 활성 안 함.

import fs from 'node:fs';
import path from 'node:path';
import { reviewCycle } from './review.js';
import { list as costList, summarize as costSummarize } from '../lib/costs.js';

const DEFAULT_MAX_ITER = Number(process.env.HARNESS_RALPH_MAX_ITER || 5);
const DAILY_CAP_USD = Number(process.env.HARNESS_DAILY_COST_CAP_USD || 0); // 0 = 무제한

export async function ralphLoop(opts) {
  const root = opts.harnessRoot || process.cwd();
  const sessionId = opts.sessionId || `ralph-${Date.now()}`;
  const maxIter = Math.max(1, Number(opts.maxIter || DEFAULT_MAX_ITER));

  const sessionDir = path.join(root, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'active'), `started_at: ${new Date().toISOString()}\nmode: ralph\n`);

  const log = (m) => console.log(`[ralph:${sessionId}] ${m}`);
  const progress = (line) => fs.appendFileSync(path.join(sessionDir, 'progress.txt'), `[${new Date().toISOString()}] ${line}\n`);

  log(`시작: max-iter=${maxIter}, task="${opts.task}"`);

  let iter = 0;
  let result;
  while (iter < maxIter) {
    iter++;
    log(`iter ${iter}/${maxIter}`);
    progress(`iter ${iter} 시작`);

    // 비용 cap 체크
    if (DAILY_CAP_USD > 0) {
      const today = costList({ since: '24h' });
      const sum = costSummarize(today);
      if (sum.total_usd >= DAILY_CAP_USD) {
        log(`STOP: daily cost cap $${DAILY_CAP_USD} 도달 (현재 $${sum.total_usd})`);
        progress(`STOP cost cap`);
        return finish(sessionDir, 'cost_cap', { iter, sum });
      }
    }

    // review 사이클 1회 (no-ship)
    result = await reviewCycle({
      task: opts.task,
      live: opts.live,
      secure: opts.secure,
      noShip: true,
      sessionId: `${sessionId}-i${iter}`,
      harnessRoot: root,
    });

    if (result.humanGate) {
      log(`STOP: HUMAN_GATE - ${result.reason}`);
      progress(`STOP human_gate ${result.reason}`);
      // ralph 세션의 active 도 제거
      try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
      // ralph 세션 자체에도 HUMAN_GATE 마커
      fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), `reason: ${result.reason}\nfrom: ${result.sessionId}\n`);
      return finish(sessionDir, 'human_gate', { iter, last: result });
    }

    // ralph sessionDir 의 prd.json 을 진실 원본으로 사용. 첫 iter 에 review 결과에서 복사,
    // 이후 iter 마다 passes:false 한 건을 true 로 (mock 모드).
    // live 모드에서는 executor 가 ralph prd.json 을 직접 갱신해야 함 (live wiring 미연결).
    const ralphPrd = path.join(sessionDir, 'prd.json');
    if (!fs.existsSync(ralphPrd)) {
      const reviewPrd = path.join(result.sessionDir, 'prd.json');
      if (fs.existsSync(reviewPrd)) fs.copyFileSync(reviewPrd, ralphPrd);
    }
    if (fs.existsSync(ralphPrd)) {
      const prd = JSON.parse(fs.readFileSync(ralphPrd, 'utf8'));
      const next = (prd.acceptance || []).find(a => !a.passes);
      if (next) {
        next.passes = true;
        fs.writeFileSync(ralphPrd, JSON.stringify(prd, null, 2));
        progress(`AC ${next.id} → passes:true`);
      }
      const total = (prd.acceptance || []).length;
      const passed = (prd.acceptance || []).filter(a => a.passes).length;
      log(`AC 진행: ${passed}/${total} PASS`);
      if (passed === total && total > 0) {
        log(`전체 AC PASS — 종료`);
        progress(`STOP all_ac_passed`);
        try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
        return finish(sessionDir, 'all_passed', { iter, last: result });
      }
    }
  }

  log(`STOP: max-iter ${maxIter} 도달`);
  progress(`STOP max_iter`);
  try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
  return finish(sessionDir, 'max_iter', { iter, last: result });
}

function finish(sessionDir, reason, extras) {
  const summary = { reason, finished_at: new Date().toISOString(), ...extras };
  fs.writeFileSync(path.join(sessionDir, 'ralph-summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
