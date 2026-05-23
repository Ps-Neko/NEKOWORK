import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { fixtureSchemas } from './src/fixture-schema';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixtureValidatorPlugin(): Plugin {
  return {
    name: 'visualizer-fixture-validator',
    buildStart() {
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);

      const validators = new Map<keyof typeof fixtureSchemas, ValidateFunction>();
      for (const key of Object.keys(fixtureSchemas) as Array<keyof typeof fixtureSchemas>) {
        const schema = fixtureSchemas[key];
        validators.set(key, ajv.compile(schema));
      }

      const fixturesDir = join(__dirname, 'fixtures');
      if (!existsSync(fixturesDir)) {
        this.warn('fixture validator: fixtures/ directory missing — skipping validation');
        return;
      }

      const fixtureIds = readdirSync(fixturesDir).filter((name) => {
        const full = join(fixturesDir, name);
        return statSync(full).isDirectory();
      });

      if (fixtureIds.length === 0) {
        this.warn('fixture validator: no fixture directories found under fixtures/');
        return;
      }

      const errors: string[] = [];

      for (const id of fixtureIds) {
        const dir = join(fixturesDir, id);
        const evidenceDir = join(dir, 'evidence');

        validateOne(this, validators, errors, join(dir, 'sample-pr.json'), 'samplePr');
        validateOne(this, validators, errors, join(dir, 'decision.json'), 'decision');
        validateOne(this, validators, errors, join(dir, 'claude-review.json'), 'claudeReview');
        validateOne(this, validators, errors, join(evidenceDir, 'preverify-summary.json'), 'preverifySummary');
        validateOne(this, validators, errors, join(evidenceDir, 'verify-summary.json'), 'verifySummary');
        validateOne(this, validators, errors, join(evidenceDir, 'decision.json'), 'decision');
      }

      if (errors.length > 0) {
        const message = `fixture validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):\n  - ${errors.join('\n  - ')}`;
        this.error(message);
      }
    }
  };
}

function validateOne(
  ctx: { error: (msg: string) => void },
  validators: Map<keyof typeof fixtureSchemas, ValidateFunction>,
  errors: string[],
  filePath: string,
  schemaKey: keyof typeof fixtureSchemas
): void {
  if (!existsSync(filePath)) {
    errors.push(`${filePath}: missing`);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${filePath}: invalid JSON — ${msg}`);
    return;
  }

  const validator = validators.get(schemaKey);
  if (!validator) {
    errors.push(`${filePath}: no validator for schema "${schemaKey}"`);
    return;
  }

  if (!validator(parsed)) {
    const details = (validator.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`).join('; ');
    errors.push(`${filePath}: schema "${schemaKey}" failed — ${details}`);
  }
  // ctx 자체는 errors aggregation 후 호출하므로 여기선 미사용
  void ctx;
}

export default defineConfig({
  base: '/NEKOWORK/',
  root: '.',
  plugins: [fixtureValidatorPlugin()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
