import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'index.html',
  'src/app.js',
  'src/styles.css',
  'fixtures/market.json',
];

for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`missing required file: ${file}`);
}

const combined = files
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n')
  .toLowerCase();

const forbidden = [
  'fetch(',
  'xmlhttprequest',
  'websocket',
  'broker-sdk',
  'stripe',
  'paypal',
  'alpaca',
  'interactivebrokers',
  'binance',
  'coinbase',
];

for (const token of forbidden) {
  if (combined.includes(token)) {
    throw new Error(`mock project must not include outbound or real-money wiring: ${token}`);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!/disabled/.test(html)) throw new Error('order ticket must keep controls disabled');
if (!/Demo data only/.test(html)) throw new Error('safety notice must be visible');

const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/market.json'), 'utf8'));
if (!Array.isArray(fixture.portfolio) || fixture.portfolio.length < 6) {
  throw new Error('portfolio fixture must include chart data');
}
if (!Array.isArray(fixture.symbols) || fixture.symbols.length < 3) {
  throw new Error('symbol fixture must include watchlist data');
}

console.log('trading-dashboard-mock checks passed');
