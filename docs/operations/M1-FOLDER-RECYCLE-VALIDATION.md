# M1 folder subtree recycle validation — 2026-11-15

Branch `feature/m1-folder-recycle`, based on main `4ae4d079b9257a9dd711678a99eef969f089890e`. Script recycle PR #25 is merged; its CI and title checks passed ([CI](https://github.com/sunstriker2009/sun-workbench/actions/runs/43696143207)). No open PR or AGENTS.md was found at run start. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) continues to permit CI-gated squash auto-merge with final manual product review. Protections, CI triggers, branding and release/publishing remain unchanged.

Implemented folder subtree delete/restore with explicit format v3 migration, exact pre-upgrade v1/v2 checkpoint and retained source files. Deleted trees preserve all folder IDs, active scripts and independently deleted scripts as separate partitions. Restoring never silently resurrects previously deleted scripts. Root name/destination are explicit; original parents can be unavailable. Global identities, connectedness, source integrity and combined live/trash limits are validated. Ordinary v3 script delete/restore retains schema and folder trash.

Validation on Linux with .NET SDK 10.0.404 and existing lockfile-matching dependencies:

- Release host build: passed, zero warnings/errors.
- TypeScript check and renderer build: passed.
- `npm test`: 15 passed, zero failed/skipped, including folder request bounds/result placement.
- `npm run test:host`: 33 passed, zero failed/skipped. Four new cases cover nested/empty folder identities, JavaScript/Python/C# sources, pre-deleted state, v2 migration consent/checkpoint, restart, ordinary v3 writes, stale revisions, changed/missing/linked sources, name/destination conflicts, external metadata, original-parent deletion, malformed/cross-tree identities and combined folder/script caps.
- One additional real-host test run with `--test-name-pattern='abrupt death around folder'`: passed. It terminates the host after observing upgrade backup filesystem activity, then requires complete active or complete deleted visibility with all source bytes intact. This validates recovery around an observed process termination, not a power-loss guarantee or a particular instruction boundary. Total distinct real-host tests passed: 34.
- Headless Electron workspace acceptance: passed using the real renderer, bridge and host. New checks cover dirty folder deletion disabled; cancel keeps exact disk/editor state; successful subtree delete clears an affected editor only after commit; v2 checkpoint bytes; retained unrelated script; close/reopen bin; restore-name conflict leaves manifest intact; renamed restoration preserves original script identity and content.

The first new desktop test attempt failed because its setup expected `Utilities` beneath `Archive` after an earlier test had moved it back to root. Corrected the setup to move it through the actual UI before deletion; the complete desktop check then passed. No product code change was needed for that test failure.

The pre-commit interruption-state test explicitly constructs a checkpoint and partial manifest temp before restart; both it and the actual process-termination test passed. All existing host recovery tests also passed. Folder source checks stream bounded files rather than accumulating tree content. Folder operations use a 30-second request deadline and document uncertain outcomes/reopen-before-retry behaviour.

No new Windows workflow, packaged desktop, clean-machine, accessibility or power-loss acceptance was run. The M0 Windows foundation baseline remains distinct. Final human product review, tags/favourites/collections/search, safe import/export/full backup and remaining M1–M5 acceptance stay open. No runner or M6 work is included.
