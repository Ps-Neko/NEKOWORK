// Heavy (@ps-neko/nekowork-harness) apply orchestrator — thin re-export shim.
//
// The full apply body (handoff/gate/ship-ready preconditions, approval-to-diff
// hash binding, git-worktree cleanliness check, mutation-guarded patch apply,
// summary + decision writes) is byte-identical to the SLIM @ps-neko/nekowork
// source, so heavy re-exports it instead of carrying a drifting copy. Same
// pattern as _handoff-utils.js.
//
// Note: the prior heavy copy imported withGitMutationGuardSync from the SLIM
// guard because heavy's LOCAL guard only had the async variant. Re-exporting
// slim's applyCycle preserves that exact behavior — slim's applyCycle already
// uses slim's own (Sync-capable) guard — so heavy keeps its extra-mutation
// protection without any heavy-local plumbing.
//
// The heavy consumers (cli.js, run.js, and the apply unit test) import these:
//   applyCycle           — cli.js, run.js
//   _readApplyGitStatus  — apply test
//   _readPriorHandoffs / _latestStageHandoff / _readDiffForHandoff — parity hooks
export {
  applyCycle,
  _readPriorHandoffs,
  _latestStageHandoff,
  _readDiffForHandoff,
  _readApplyGitStatus,
} from '@ps-neko/nekowork/scripts/orchestrators/apply.js';
