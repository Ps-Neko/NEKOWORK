import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDoctorReport, parseDoctorArgs, renderDoctorReport } from '../../scripts/doctor.js';

function makeRoot(pkg = { name: '@ps-neko/nekowork', version: '0.0.2', private: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-doctor-root-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  return root;
}

function runCommandPass(command, args) {
  if (command === 'git') return { status: 0, stdout: 'true\n', stderr: '' };
  return { status: 0, stdout: 'ok\n', stderr: '' };
}

test('doctor args parse json, quick, and project root', () => {
  const parsed = parseDoctorArgs(['--json', '--quick', '--project-root', 'target']);
  assert.equal(parsed.json, true);
  assert.equal(parsed.quick, true);
  assert.equal(parsed.projectRoot, 'target');
});

test('doctor args reject unknown flags', () => {
  assert.throws(() => parseDoctorArgs(['--wat']), /unknown doctor option/);
});

test('doctor report passes core checks without provider CLIs in quick mode', () => {
  const root = makeRoot();
  const report = buildDoctorReport({
    harnessRoot: root,
    projectRoot: root,
    env: { PATH: '' },
    nodeVersion: '22.1.0',
    quick: true,
    runCommand: runCommandPass,
  });

  assert.equal(report.summary.fail, 0);
  assert.ok(report.checks.some((check) => check.name === 'package metadata' && check.status === 'PASS'));
  assert.ok(report.checks.some((check) => check.name === 'claude cli' && check.status === 'WARN'));
});

test('doctor reports node and package failures', () => {
  const root = makeRoot({ name: '@wrong/name', version: '0.0.2', private: true });
  const report = buildDoctorReport({
    harnessRoot: root,
    projectRoot: root,
    env: { PATH: '' },
    nodeVersion: '20.9.0',
    quick: true,
    runCommand: runCommandPass,
  });

  assert.ok(report.checks.some((check) => check.name === 'node' && check.status === 'FAIL'));
  assert.ok(report.checks.some((check) => check.name === 'package metadata' && check.status === 'FAIL'));
  assert.equal(report.summary.status, 'FAIL');
});

test('doctor flags delegated API key environment overrides', () => {
  const root = makeRoot();
  const report = buildDoctorReport({
    harnessRoot: root,
    projectRoot: root,
    env: { PATH: '', OPENAI_API_KEY: 'sk-test' },
    nodeVersion: '22.1.0',
    quick: true,
    runCommand: runCommandPass,
  });

  const check = report.checks.find((item) => item.name === 'api key env');
  assert.equal(check.status, 'WARN');
  assert.match(check.message, /OPENAI_API_KEY/);
});

test('doctor freshness failures affect overall status', () => {
  const root = makeRoot();
  const report = buildDoctorReport({
    harnessRoot: root,
    projectRoot: root,
    env: { PATH: '' },
    nodeVersion: '22.1.0',
    quick: false,
    runCommand(command, args) {
      if (command === 'git') return { status: 0, stdout: 'true\n', stderr: '' };
      if (args.some((arg) => arg.includes('build-codemaps.js'))) return { status: 1, stdout: '', stderr: 'stale codemap\n' };
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });

  assert.ok(report.checks.some((check) => check.name === 'codemaps freshness' && check.status === 'FAIL'));
  assert.equal(report.summary.status, 'FAIL');
});

test('doctor render is a compact table', () => {
  const root = makeRoot();
  const report = buildDoctorReport({
    harnessRoot: root,
    projectRoot: root,
    env: { PATH: '' },
    nodeVersion: '22.1.0',
    quick: true,
    runCommand: runCommandPass,
  });

  const output = renderDoctorReport(report);
  assert.match(output, /NEKOWORK doctor/);
  assert.match(output, /STATUS\s+CHECK/);
  assert.match(output, /summary:/);
});
