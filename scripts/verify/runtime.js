#!/usr/bin/env node
// Rust runtime verification smoke: cargo build/test/clippy plus CLI IPC checks.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveCli } from '../core/cli-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const runtimeDir = path.join(root, 'runtime');

const cargo = resolveCargo();
const runtimeBin = path.join(
  runtimeDir,
  'target',
  'release',
  process.platform === 'win32' ? 'harness-runtime.exe' : 'harness-runtime',
);

console.log(`cargo: ${cargo}`);

run(cargo, ['build', '--release'], { cwd: runtimeDir, inherit: true });
run(cargo, ['test'], { cwd: runtimeDir, inherit: true });
run(cargo, ['clippy', '--all-targets', '--', '-D', 'warnings'], { cwd: runtimeDir, inherit: true });

if (!fs.existsSync(runtimeBin)) {
  throw new Error(`runtime binary not found after build: ${runtimeBin}`);
}

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-runtime-smoke-'));
try {
  run(runtimeBin, ['--help'], { cwd: root, inherit: true });
  run(runtimeBin, ['--root', smokeRoot, 'init'], { cwd: root, inherit: true });
  run(runtimeBin, ['--root', smokeRoot, 'status'], { cwd: root, inherit: true });

  const ping = run(runtimeBin, ['--root', smokeRoot, 'ipc'], {
    cwd: root,
    input: '{"id":1,"method":"ping"}\n',
  });
  const response = JSON.parse(ping.trim());
  if (response?.id !== 1 || response?.result?.pong !== true || response.error) {
    throw new Error(`unexpected IPC ping response: ${ping}`);
  }
  console.log(`ipc ping: ${ping.trim()}`);
} finally {
  fs.rmSync(smokeRoot, { recursive: true, force: true });
}

console.log('Runtime verification PASS');

function resolveCargo() {
  if (process.env.HARNESS_CARGO) return process.env.HARNESS_CARGO;

  const onPath = resolveCli('cargo');
  if (onPath) return onPath;

  const exe = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const candidates = [
    path.join(os.homedir(), '.cargo', 'bin', exe),
  ];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(os.homedir(), '.rustup', 'toolchains', 'stable-x86_64-pc-windows-msvc', 'bin', exe),
    );
  }

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) return found;

  throw new Error([
    'cargo was not found on PATH or in the default rustup locations.',
    'Install Rust from https://rustup.rs or set HARNESS_CARGO to the cargo executable path.',
  ].join('\n'));
}

function run(bin, args, options = {}) {
  const command = [quote(bin), ...args.map(quote)].join(' ');
  console.log(`> ${command}`);

  const result = spawnSync(bin, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stdout = result.stdout ? `\nstdout:\n${result.stdout}` : '';
    const stderr = result.stderr ? `\nstderr:\n${result.stderr}` : '';
    throw new Error(`${command} exited ${result.status}${stdout}${stderr}`);
  }

  return result.stdout || '';
}

function quote(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text}"` : text;
}
