# M1 folder subtree duplication — validation 2026-11-14

Implemented in `feature/m1-folder-duplicate` on main `8bf8a52129db341d5219047d38cfe60d06684ca6`. Main's tree (`76e4ab7`) equals the previously validated PR #16 head. PRs #14–#16 are merged; this batch is independent of the earlier stack. No AGENTS.md exists in the fetched repository tree. The owner's [auto-merge/final-review instruction](DEVELOPMENT-AUTHORIZATION.md) is recorded separately; GitHub protections are unchanged.

## Behavior and bounds

Copy a logical folder and all descendants/saved scripts to an explicit name and destination, with fresh identities and independent source directories. Preserve original metadata/content, nested/empty folders and all languages. Reject subtree destinations, sibling collisions, missing folders, stale loaded revision, external metadata/source changes and invalid UTF-8. Validate all sources and the complete next manifest before staging. Per-operation aggregate source bound: 8 MiB; existing file/catalog/manifest limits remain. One manifest replacement publishes the whole subtree. Late conflicts/interruption may retain ignored orphan directories; do not automatically retry uncertain outcomes. The desktop allows a bounded 30-second copy request. Schema stays v1, with no migration or dropped metadata.

The UI requires saved open edits, retains the editor and selects the copied root. Existing renderer isolation, sender validation and narrow bridge remain. No scripts execute during copying; eventual execution uses normal OS permissions, not a script security sandbox.

## Local evidence

Isolated source snapshot fetched from GitHub, .NET SDK 10.0.404, Node 24.22.1, Linux x64:

- .NET Release build: zero warnings/errors. TypeScript check and renderer build passed.
- 13 protocol/client/startup/package-layout tests passed, including revision-bound and result/destination validation.
- Real development-host suite: all 24 tests passed. Fresh self-contained Linux-host suite: all 24 passed with empty PATH and invalid installed runtime root through the harness.
- New cases cover nested/empty subtrees, JavaScript/Python/C#, exact Unicode/CRLF bytes, disjoint identities, independent edits/reopen persistence, single revision increment, stale revision/source/manifest conflicts, missing/invalid/linked source rejection, folder/script caps, exhausted revision, and aggregate source above/exactly 8 MiB. Preflight failures preserve manifest bytes and managed directories.
- Actual abrupt process termination: watch for copy staging and kill the real host, then reopen. The recovered manifest exposes all or none of the new subtree; original metadata/source remains intact and all referenced files are readable. Passed against development and self-contained hosts. This is process-death acceptance, not a power-loss test.
- Real headless Electron/Monaco workspace flow passed: duplicate-folder name rejection preserves metadata, explicit destination copy, current-editor retention, copied-script reopen and dirty-buffer guard; existing script duplication, folder move, save/external adoption and cancelled-quit checks also passed. Sandbox/web security remained enabled.
- Reviewed the 900-pixel-wide editor screenshot and passed `git diff --check`.

No packaged application rebuild, Windows workflow run, interactive/clean-machine test, release, dependency/branding change or CI-definition change occurred for this batch. Existing manual-only Windows acceptance uses the expanded editor flow; no schedule/matrix added.

## Remaining work

Delete/restore, tags/favourites/collections/search, import/export/backup/restore and M2–M5 remain open. New organizer Windows acceptance is still distinct from M0 foundation run 43609933010 at `517277c`. Final manual product acceptance and governance enforcement follow-ups remain open. Enable CI-gated squash auto-merge for this ready PR under the recorded owner instruction; never treat that as passing an unrun acceptance gate.
