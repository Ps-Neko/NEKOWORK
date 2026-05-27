#!/usr/bin/env node
// OSS positive-fixture scraper for verify-pr rules.
//
// Uses `gh search code` to find real-world examples of risk patterns, fetches
// each file pinned to the repo's current default-branch SHA, and writes them
// into the fixtures tree as *candidates* for human review.
//
// CRITICAL: this script DOES NOT auto-promote candidates into the active
// manifest. It writes them to a `candidates/` subdirectory with a
// `candidates.json` index. A human must (a) read each file, (b) confirm the
// match is a real positive (not a default template or a comment), and (c)
// copy validated entries into the rule's `manifest.json`.
//
// Why: rule corpora must remain trustworthy. Scrapers produce false candidates
// — empty `|| ""` fallbacks (which the regex doesn't match by design), code
// inside markdown / docs, intentional dev-defaults, etc. Auto-promotion would
// silently inflate or deflate recall.
//
// Usage:
//   node scripts/benchmark/scrape-oss-positives.js \
//     --rule secret-fallback \
//     --query 'process.env.JWT_SECRET || "' \
//     --limit 20
//
//   node scripts/benchmark/scrape-oss-positives.js --help
//
// Requirements: gh CLI authenticated with `gh auth login`. Network access.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.join(ROOT, 'tests', 'fixtures');

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.rule && !args.query)) {
  console.log(`
OSS positive-fixture scraper

Required:
  --rule <id>            Rule fixture dir (e.g. secret-fallback)
  --query <string>       gh search code query (quote it)

Optional:
  --limit <n>            Max candidates (default 20, max 100)
  --language <lang>      Restrict by language (e.g. typescript, javascript)
  --min-stars <n>        Skip repos below this star count (default 0)
  --dry-run              Show what would be fetched, don't write files

Examples:
  node scripts/benchmark/scrape-oss-positives.js \\
    --rule secret-fallback \\
    --query 'process.env.JWT_SECRET || "' \\
    --language typescript \\
    --limit 30 \\
    --min-stars 50

After running: human-review each candidate, then promote validated ones into
the rule's manifest.json. The script never modifies an active manifest.
`);
  process.exit(args.help ? 0 : 1);
}

const rule = args.rule;
const query = args.query;
const limit = Math.min(parseInt(args.limit || '20', 10), 100);
const language = args.language || null;
const minStars = parseInt(args['min-stars'] || '0', 10);
const dryRun = !!args['dry-run'];

const fixtureDir = path.join(FIXTURE_ROOT, rule);
if (!fs.existsSync(fixtureDir)) {
  console.error(`No fixture dir for rule "${rule}" at ${fixtureDir}`);
  process.exit(1);
}

const candidatesDir = path.join(fixtureDir, 'positive', 'candidates');
const candidatesIndexPath = path.join(candidatesDir, 'candidates.json');

if (!dryRun) {
  fs.mkdirSync(candidatesDir, { recursive: true });
}

console.log(`Scraping for rule "${rule}"`);
console.log(`  query: ${query}`);
console.log(`  limit: ${limit}`);
if (language) console.log(`  language: ${language}`);
if (minStars > 0) console.log(`  min stars: ${minStars}`);
if (dryRun) console.log(`  (dry-run: no files will be written)`);
console.log();

const ghArgs = ['search', 'code', query, '--limit', String(limit), '--json', 'repository,path,textMatches'];
if (language) ghArgs.push('--language', language);

let searchOutput;
try {
  searchOutput = execSync('gh ' + ghArgs.map(a => /[\s"]/.test(a) ? JSON.stringify(a) : a).join(' '), {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
} catch (err) {
  console.error('gh search failed:', err.message);
  process.exit(1);
}

const results = JSON.parse(searchOutput);
console.log(`Got ${results.length} raw results from GitHub code search.\n`);

// Cache default-branch SHA per repo to avoid repeated API calls.
const repoSha = new Map();
const repoStars = new Map();

const candidates = [];
const skipped = [];

for (const r of results) {
  const repo = r.repository.nameWithOwner;
  const filePath = r.path;
  const snippet = r.textMatches?.[0]?.fragment || '';

  // Filter 1: obvious doc files
  if (/^(README|CHANGELOG|CONTRIBUTING|LICENSE|NOTICE)\b/i.test(path.basename(filePath))) {
    skipped.push({ repo, filePath, reason: 'doc file' });
    continue;
  }
  if (/\.(md|mdx|rst|txt)$/i.test(filePath)) {
    skipped.push({ repo, filePath, reason: 'markdown/text' });
    continue;
  }

  // Filter 2: get repo metadata if not cached
  if (!repoStars.has(repo)) {
    try {
      const repoJson = JSON.parse(execSync(
        `gh api repos/${repo}`,
        { encoding: 'utf8' }
      ));
      repoStars.set(repo, repoJson.stargazers_count);
      const defaultBranch = repoJson.default_branch;
      const commitJson = JSON.parse(execSync(
        `gh api repos/${repo}/commits/${defaultBranch}`,
        { encoding: 'utf8' }
      ));
      repoSha.set(repo, commitJson.sha);
    } catch (err) {
      skipped.push({ repo, filePath, reason: 'repo metadata fetch failed: ' + err.message.slice(0, 60) });
      continue;
    }
  }

  if (repoStars.get(repo) < minStars) {
    skipped.push({ repo, filePath, reason: `stars ${repoStars.get(repo)} < min ${minStars}` });
    continue;
  }

  const sha = repoSha.get(repo);

  // Fetch file content at the pinned SHA
  let content;
  try {
    const contentJson = JSON.parse(execSync(
      `gh api "repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${sha}"`,
      { encoding: 'utf8' }
    ));
    content = Buffer.from(contentJson.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch (err) {
    skipped.push({ repo, filePath, reason: 'content fetch failed: ' + err.message.slice(0, 60) });
    continue;
  }

  const safeName = sanitizeFilename(`${repo}__${filePath}`).slice(0, 120);
  const ext = path.extname(filePath) || '.txt';
  const outFile = `${safeName}${ext.startsWith('.') ? ext : '.' + ext}`;
  const outPath = path.join(candidatesDir, outFile);

  if (!dryRun) {
    fs.writeFileSync(outPath, content, 'utf8');
  }

  candidates.push({
    id: `candidate-${candidates.length + 1}`,
    label: 'positive',
    source: `github:${repo}@${sha}:${filePath}`,
    file: `positive/candidates/${outFile}`,
    stars: repoStars.get(repo),
    snippet_preview: snippet.slice(0, 200),
    fetched_at: new Date().toISOString().slice(0, 10),
    review_status: 'pending',
    notes: 'Auto-fetched. Confirm pattern is a real positive before promoting to manifest.json.',
  });

  console.log(`  + ${repo} (${repoStars.get(repo)}⭐) — ${filePath}`);
}

if (!dryRun) {
  fs.writeFileSync(
    candidatesIndexPath,
    JSON.stringify({
      fixture_set: `${rule}-candidates`,
      generated_at: new Date().toISOString(),
      query,
      language,
      min_stars: minStars,
      candidates,
      skipped_summary: {
        total: skipped.length,
        reasons: skipped.reduce((acc, s) => { acc[s.reason] = (acc[s.reason] || 0) + 1; return acc; }, {}),
      },
    }, null, 2)
  );
}

console.log(`\nResults: ${candidates.length} candidates written, ${skipped.length} skipped.`);
console.log(`\nNext step: review each file under ${candidatesDir}`);
console.log(`Then promote validated entries into ${path.join(fixtureDir, 'manifest.json')}`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}

function sanitizeFilename(s) {
  return s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}
