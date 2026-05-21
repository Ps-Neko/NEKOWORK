#!/usr/bin/env node
// HARNESS:START / HARNESS:END 마커 무결성 검증.
// 사용자 작성 영역과 자동 갱신 영역 사이가 짝지어져 있는지.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// 마커 사용 옵트인 파일 (자동 갱신 영역을 갖는 문서만 등록).
// AGENTS.md 는 정전 풀 수동 문서이므로 미포함.
const FILES = ['CLAUDE.md'];
const START = /<!--\s*HARNESS:START(?:\s+version=\S+)?\s*-->/;
const END = /<!--\s*HARNESS:END\s*-->/;

let ok = true;

for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) {
    console.error(`[SKIP] ${f} 없음`);
    continue;
  }
  const content = fs.readFileSync(p, 'utf8');
  const startIdx = content.search(START);
  const endIdx = content.search(END);

  if (startIdx === -1 && endIdx === -1) {
    console.error(`[WARN] ${f}: 마커 없음 (자동 갱신 영역 없음)`);
    continue;
  }
  if (startIdx === -1 || endIdx === -1) {
    console.error(`[FAIL] ${f}: 마커가 짝이 안 맞음`);
    ok = false;
    continue;
  }
  if (startIdx > endIdx) {
    console.error(`[FAIL] ${f}: HARNESS:END 가 HARNESS:START 앞에 있음`);
    ok = false;
    continue;
  }
  const body = content.substring(startIdx, endIdx);
  console.error(`[OK]   ${f}: 자동 영역 ${body.length} bytes`);
}

if (!ok) process.exit(1);
