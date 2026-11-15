# M2 automatic checkpoints and close flush — local evidence, 2026-11-15

Implemented on `feature/m2-automatic-checkpoints`, based on merged manual recovery PR #33 (`04c725d1`). Live GitHub showed no open implementation PR at start. [ADR-009](../adr/0009-automatic-checkpoints.md) records timing, review gates, serialization and close semantics. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) permits CI-gated squash auto-merge; final human product review remains open.

## Checks run

- .NET SDK 10.0.404 Release host build: zero warnings/errors. Host implementation/protocol/recovery schema are unchanged by this batch.
- TypeScript check and renderer build passed.
- All 26 frontend/protocol/startup/portable-layout/coordinator tests passed. Five new coordinator tests exercise skipped unchanged/clean captures, foreground deferral/forced flush, one in-flight write, capture-latest after an older acknowledgement, failure pause/no retry/flush rejection, explicit restart and drain after stop. The startup fixture executes actual main close handlers, covering correlated preparation, duplicate attempts, failed readiness, untrusted/stale acknowledgement rejection and successful close.
- Real headless Electron workspace acceptance passed with existing organizer/import/archive/tab/manual-recovery checks plus timed two-tab checkpointing, unchanged canonical metadata, immediate normal-close flush before the discard prompt, cancelled-quit host preservation, external checkpoint conflict/pause, blocked normal close (before any discard prompt) and lease release on failed flush, explicit reconciliation, workspace-close flush, explicit recovery after reopen, and different-workspace creation without copying old draft data or automatic mode.
- Real headless foundation smoke passed: exact bridge surface, Monaco mount, sandbox/context isolation/renderer Node restrictions and real host IPC.
- `git diff --check` passed.

The startup mock was extended to model BrowserWindow lifecycle and IPC events. Production automatic-write code is exercised directly in coordinator tests with controlled scheduling; no production test hooks or extra CI jobs/matrix/triggers are added. Node.js 24 is the existing development/CI baseline. The unchanged 63-test host suite was not rerun for this renderer/lifecycle batch; real host recovery writes were exercised by the desktop test, and CI retains its existing host checks.

## Remaining acceptance

Check the new PR for required CI/merge state. Automatic mode is opt-in per workspace session and may lose unacknowledged edits on abrupt termination or renderer reload. Normal-close preparation is not a guarantee for all OS shutdown, crash or power-loss paths. Windows automatic checkpoint/close/organizer/editor/import/restore, clean-machine, installer, full shutdown, accessibility/performance, governance and final human review were not run here. The M0 Windows baseline (run 43609933010, commit `517277cbee5bd958748d5e5a25bb77c1a2c81cb1`) stays distinct. Formatting, runners, persistent catalog, collection extensions/examples and other M1–M5 gates remain open.
