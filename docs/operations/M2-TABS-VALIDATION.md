# M2 editor tabs — local evidence, 2026-11-15

Implemented on `feature/m2-editor-tabs`, based on merged loose-import PR #31 (`1e3d5706`). No other open PR was present at start. [ADR-007](../adr/0007-editor-tabs.md) describes the model ownership, capacity, discard and external-edit contract. Owner authorization permits CI-gated squash auto-merge; final human product review remains outstanding.

## Checks actually run

- .NET SDK 10.0.404 Release host build: zero warnings/errors.
- TypeScript check and renderer build passed.
- All 20 frontend/protocol/portable-layout/startup tests passed.
- All 57 real-host integration tests passed, zero skips/failures.
- Real headless Electron foundation smoke passed: Monaco mount, exact bridge method surface, renderer isolation and real host IPC. This run exposed stale M1 method expectations in the foundation smoke, which were updated to the current exact allowlist; isolation assertions remain unchanged.
- Real headless Electron workspace acceptance passed with the renderer sandbox and existing bridge/host. Existing organizer/import/archive checks remain active.
- Extended desktop checks exercise separate source/name/language/label drafts, switching without discard, inactive dirty-tab close cancellation, inactive workspace/quit guards, active-only Reload, source-save label preservation, keyboard undo after save and redo after switching, cancelled restore picker after discard consent, explicit close/reopen with saved source retained, inactive external edits/stale-save rejection with draft retention, explicit Reload cancellation/adoption, 16-tab capacity and create preflight, selecting existing tabs at capacity, closing/reopening capacity and keyboard tab close.

The desktop test continues to cover folder recycling with unrelated tabs retained. It creates tab fixtures only through the validated bridge and uses native keyboard events for undo/redo and close; no production test hooks are added. Initial empty-model handling retains the foundation Monaco mount contract. Evidence is automated Linux development acceptance, not interactive or Windows acceptance.

## Remaining gates

Check the PR for required CI/merge state. Tab state is not persisted: autosave/crash recovery and session restoration remain unfinished. Full cursor/scroll/accessibility and keyboard behaviour on Windows need their own acceptance. No new Windows portable/package, clean-machine, power-loss, installer, runner or final product review was performed. The M0 Windows baseline (run 43609933010, commit `517277cbee5bd958748d5e5a25bb77c1a2c81cb1`) remains distinct. Persistent catalog/collection extensions/examples, formatter/recovery/runners and other M1–M5 gates remain open.
