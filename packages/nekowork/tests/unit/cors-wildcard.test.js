import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/cors-wildcard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'cors-wildcard');

test('setHeader wildcard, no credentials → medium', () => {
  const f = scanFileContent('x.js', "res.setHeader('Access-Control-Allow-Origin', '*');");
  assert.equal(f[0].pattern, 'acao-set-header-wildcard');
  assert.equal(f[0].severity, 'medium');
});

test('wildcard + credentials → high', () => {
  const src = "res.setHeader('Access-Control-Allow-Origin', '*');\nres.setHeader('Access-Control-Allow-Credentials', 'true');";
  const f = scanFileContent('x.js', src);
  assert.ok(f.some(x => x.severity === 'high'));
});

test('cors middleware wildcard origin → flagged', () => {
  const f = scanFileContent('x.js', "cors({ origin: '*', credentials: true });");
  assert.equal(f[0].pattern, 'cors-mw-wildcard-origin');
  assert.equal(f[0].severity, 'high');
});

test('explicit origin → not flagged', () => {
  const f = scanFileContent('x.js', "res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');");
  assert.equal(f.length, 0);
});

test('cors with explicit origin → not flagged', () => {
  const f = scanFileContent('x.js', "cors({ origin: 'https://app.example.com', credentials: true });");
  assert.equal(f.length, 0);
});

test('fixture manifest: recall + FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, fp = 0, negTotal = 0;
  const missed = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++; else missed.push(e.id);
    } else {
      negTotal++;
      if (findings.length > 0) fp++;
    }
  }
  const recall = posCaught / posTotal;
  assert.ok(recall >= 0.95, `recall ${recall.toFixed(2)} below 0.95; missed: ${missed.join(', ')}`);
  assert.ok(fp / negTotal <= 0.10, `FP rate above 0.10`);
});

// ---------- R2-8: Django / FastAPI CORS ----------

test('Django CORS_ALLOW_ALL_ORIGINS = True: flagged', () => {
  assert.ok(scanFileContent('s.py', 'CORS_ALLOW_ALL_ORIGINS = True').some(t => t.pattern === 'django-cors-allow-all'));
});

test('Django legacy CORS_ORIGIN_ALLOW_ALL = True: flagged', () => {
  assert.ok(scanFileContent('s.py', 'CORS_ORIGIN_ALLOW_ALL = True').some(t => t.pattern === 'django-cors-allow-all'));
});

test('FastAPI allow_origins=["*"]: flagged', () => {
  assert.ok(scanFileContent('m.py', 'app.add_middleware(CORSMiddleware, allow_origins=["*"])').some(t => t.pattern === 'fastapi-allow-origins-wildcard'));
});

test('FastAPI allow_origins=["*"] + allow_credentials=True: high', () => {
  const f = scanFileContent('m.py', 'add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)');
  assert.ok(f.some(t => t.pattern === 'fastapi-allow-origins-wildcard' && t.severity === 'high'));
});

test('Django CORS_ALLOW_ALL_ORIGINS = False / explicit FastAPI origins: not flagged', () => {
  assert.equal(scanFileContent('s.py', 'CORS_ALLOW_ALL_ORIGINS = False').length, 0);
  assert.equal(scanFileContent('m.py', 'allow_origins=["https://app.example.com"]').length, 0);
});
