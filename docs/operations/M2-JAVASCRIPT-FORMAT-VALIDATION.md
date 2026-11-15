# M2 JavaScript formatter — local evidence, 2026-11-15

Implemented on `feature/m2-javascript-formatting` from merged automatic-checkpoint PR #34 (`72097bba`). No open implementation PR overlapped this batch. [ADR-010](../adr/0010-javascript-formatting.md) records the pinned adapter, worker lifetime, byte limits and editor contract. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) permits CI-gated squash auto-merge; final human product review remains open.

## Checks run

- .NET SDK 10.0.404 Release host build: zero warnings/errors. TypeScript check (including worker/adapter files) and renderer/worker builds passed.
- 32 frontend/protocol/startup/portable-layout/coordinator/formatter tests passed, with six formatter tests covering deterministic/idempotent output and primary cursor mapping; non-execution; BOM/shebang/Unicode/comments/templates/CRLF; syntax/invalid cursor/Unicode/byte/output bounds; exact worker requests; bounded diagnostics; correlated/no-overlap replies; late cancellation replies; deadline, worker errors, missing/startup assets and termination. Cancellation/timeout cleanup are deterministic worker-client tests, not claims of interactive desktop timing acceptance.
- Portable Windows/Linux layout fixtures retain the formatter worker plus complete licence/third-party notices and continue excluding development material. Actual build copies were compared byte-for-byte with the pinned package; worker output was 813,066 bytes at this build.
- Real headless Electron workspace acceptance passed with the original CSP and renderer isolation. Added checks format JavaScript without executing a throwing source, preserve unsaved labels/canonical files, undo/redo before and after explicit Save, retain undo on no-op/syntax failure, distinguish missing Python formatter/runner capability, invoke Alt+Shift+F, and retain/recover the buffer after a built worker asset is temporarily removed/restored. Existing organizer/import/archive/tab/checkpoint checks remain active.
- Real headless foundation smoke passed: Monaco, exact bridge surface, renderer isolation and real host IPC.
- `npm audit --omit=dev` reported zero known vulnerabilities at the check. Prettier 3.10.1 package license/complete bundled notices were inspected and retained in generated dist. Full release dependency review remains separate.
- `git diff --check` passed.

Desktop testing caught editor-level edits being rejected under the foreground read-only lock; the implementation now uses model edit/undo operations with explicit boundaries. Native EditContext can split text insertion into word-level undo groups; the syntax-failure test compares the actual pre-format undo step instead of assuming insertion granularity. Visual text assertions wait for Monaco rendering.

## Remaining acceptance

Check the PR for required CI/merge state. Python/Ruff and C#/Roslyn adapters remain unimplemented. No new full host-suite run was needed for this renderer-only batch; desktop checks used the real host, and CI retains its existing host suites. Desktop cancellation/timeout under a deliberately stalled real parser, forcibly raced result/model changes, multicursor/scroll/accessibility, Windows/packaged/clean-machine and final product acceptance were not run. No Windows packaging/manual, OS shutdown/power-loss, signing, installer, publication or script runner acceptance was performed. M0 Windows run 43609933010 at `517277cbee5bd958748d5e5a25bb77c1a2c81cb1` stays distinct. Remaining M1–M5 catalog/collection/examples/formatter/runner/packaging gates stay open.
