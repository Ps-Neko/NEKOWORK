# External Run Evidence Kit

Use this kit when asking an outside user to try NEKOWORK and share public evidence.

The goal is not to collect private source code. The goal is:

```text
1 external user
1 real repo or real local project
1 transcript
1 REPORT.md trust card
1 short quote about whether the evidence/gate/apply boundary was clear
```

## Privacy Rules

- Redact secrets, tokens, private paths, customer names, private repository names, and proprietary source code.
- Paste summaries, not private diffs.
- Prefer `--dry-run` for first contact if the target repository is sensitive.
- Do not ask users to run `apply`, commit, push, publish, deploy, or open a PR.
- If a run touches auth, secrets, deploy, financial, or data-loss risk, keep Human Gate evidence visible.

## 10-Minute Run

Ask the tester to run:

```bash
npx -y @ps-neko/nekowork@alpha check --json
npx -y @ps-neko/nekowork@alpha auto "<their task>" --session external-run --dry-run --json
npx -y @ps-neko/nekowork@alpha auto "<their task>" --session external-run
npx -y @ps-neko/nekowork@alpha report --session external-run --stdout
npx -y @ps-neko/nekowork@alpha gate status --session external-run --json
```

If they only have time for one command after `check`, ask for:

```bash
npx -y @ps-neko/nekowork@alpha auto "<their task>" --session external-run --dry-run --json
```

## Evidence To Request

Ask for:

- OS/shell and Node/npm versions
- install path, usually `npx @ps-neko/nekowork@alpha`
- redacted command transcript
- redacted `REPORT.md` trust card
- `gate status` summary
- whether `apply` was requested
- whether NEKOWORK produced `SHIP_READY`, `NO_SHIP`, or `HUMAN_GATE`
- one short quote that can be public

## Good External Task Shapes

Prefer tasks that can show a clear decision:

- fix a failing test
- review an auth parser boundary
- check a CI or release workflow
- prepare PR evidence without opening a PR
- inspect a config/secrets boundary
- verify a small refactor before apply

## Public Quote Template

```text
I tried NEKOWORK on <kind of project/task>. It selected <mode/risk>,
produced <REPORT/NO_SHIP/HUMAN_GATE/SHIP_READY>, and the apply boundary
was <clear/confusing/useful>. I am okay with this quote being public.
```

## Maintainer Checklist

Before using the evidence in README, release notes, or case-study docs:

- confirm the user granted public quote permission
- remove private paths and private repository identifiers
- preserve the actual verdict wording where possible
- link to a public issue, discussion, gist, or repository transcript
- record whether the run was `--dry-run`, mock, or live-provider backed
- do not claim mathematical correctness; "Verified" is not mathematically proven correctness, it is independent review with recorded evidence
