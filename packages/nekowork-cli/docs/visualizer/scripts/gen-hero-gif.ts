/**
 * gen-hero-gif.ts — T5 산출물 (D7 lock 위치).
 *
 * 흐름:
 *   1. dist/ 존재 확인 (선행 `vite build` 필수)
 *   2. vite preview server 시작 (port 4173)
 *   3. playwright headless chromium 으로 4 프레임 캡처 (wedge → conflict → stations → evidence)
 *   4. ffmpeg 으로 GIF 인코딩 (palette 2-pass equivalent in single filter_complex)
 *   5. 사이즈 < 5MB hard block (design doc Distribution Plan)
 *
 * CI: T8 의 step 이 ubuntu apt install (fonts-noto-cjk + ffmpeg) + playwright install
 *     chromium 선행 후 본 스크립트 실행.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  statSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const visualizerRoot = join(__dirname, '..');
const distDir = join(visualizerRoot, 'dist');
const framesDir = join(visualizerRoot, '.frames');
const outputDir = join(visualizerRoot, '..', 'assets');
const outputPath = join(outputDir, 'hero.gif');
const MAX_BYTES = 5 * 1024 * 1024;
const PORT = '4173';
const BASE_URL = `http://localhost:${PORT}/NEKOWORK/?fixture=sample-pr-001`;

function ensureDist(): void {
  if (!existsSync(distDir)) {
    throw new Error(
      `dist/ missing at ${distDir} — run 'pnpm --filter @ps-neko/visualizer build' first`
    );
  }
}

function cleanFramesDir(): void {
  if (existsSync(framesDir)) {
    for (const f of readdirSync(framesDir)) {
      if (f.endsWith('.png')) unlinkSync(join(framesDir, f));
    }
  } else {
    mkdirSync(framesDir, { recursive: true });
  }
}

async function startPreviewServer(): Promise<ChildProcess> {
  // shell: true 로 통일 (ubuntu/macOS/Windows 모두). spawn('pnpm') 직접 호출이
  // CI ubuntu 에서 stdout 의 "Local:" 출력을 buffer 처리하지 않을 가능성을
  // HTTP polling 으로 우회. 더 robust.
  const proc = spawn('pnpm', ['exec', 'vite', 'preview', '--port', PORT, '--strictPort'], {
    cwd: visualizerRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  // 디버깅: stdout/stderr 를 그대로 host stdout 으로 (CI 의 fail log 분석 용).
  proc.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[vite preview] ${chunk.toString()}`);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[vite preview stderr] ${chunk.toString()}`);
  });

  // Ready detection = HTTP HEAD 요청 polling (stdout parsing 보다 안정).
  const readyUrl = `http://localhost:${PORT}/NEKOWORK/`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`vite preview exited early (code ${proc.exitCode})`);
    }
    try {
      const res = await fetch(readyUrl, { method: 'HEAD' });
      if (res.status >= 200 && res.status < 500) {
        console.log(`vite preview ready: ${readyUrl} (status ${res.status})`);
        return proc;
      }
    } catch {
      // not ready yet, continue polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  proc.kill();
  throw new Error(`vite preview not ready within 30s at ${readyUrl}`);
}

async function captureFrames(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ko-KR',
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const sections = ['.wedge', '.conflict', '.stations', '.evidence'];
    for (let i = 0; i < sections.length; i++) {
      if (i > 0) {
        const sel = sections[i]!;
        await page.evaluate((s) => {
          document.querySelector(s)?.scrollIntoView({ behavior: 'instant', block: 'start' });
        }, sel);
        await page.waitForTimeout(400);
      }
      const idx = String(i + 1).padStart(3, '0');
      await page.screenshot({
        path: join(framesDir, `frame-${idx}.png`),
        fullPage: false
      });
    }
  } finally {
    await browser.close();
  }
}

function encodeGif(): void {
  mkdirSync(outputDir, { recursive: true });
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate', '0.6',
      '-i', join(framesDir, 'frame-%03d.png'),
      '-filter_complex',
      '[0:v]fps=8,scale=960:-1:flags=lanczos,split[x][y];[x]palettegen=stats_mode=full[p];[y][p]paletteuse=dither=sierra2_4a',
      '-loop', '0',
      outputPath
    ],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed (exit ${result.status}). Ensure ffmpeg is on PATH (apt install ffmpeg on CI; choco/scoop install ffmpeg on Windows).`
    );
  }
}

function assertSize(): void {
  const size = statSync(outputPath).size;
  console.log(`hero.gif size: ${(size / 1024).toFixed(1)} KB`);
  if (size > MAX_BYTES) {
    throw new Error(
      `hero.gif size ${size} bytes exceeds 5MB hard block (design doc Distribution Plan)`
    );
  }
  console.log(`OK hero.gif within 5MB budget`);
}

async function main(): Promise<void> {
  ensureDist();
  cleanFramesDir();

  const server = await startPreviewServer();
  try {
    await captureFrames();
    encodeGif();
    assertSize();
  } finally {
    server.kill();
    // Windows 의 vite preview 가 SIGTERM 무시할 수 있어 짧게 SIGKILL
    setTimeout(() => {
      if (!server.killed) server.kill('SIGKILL');
    }, 500);
  }
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('gen-hero-gif failed:', msg);
  process.exitCode = 1;
});
