# M1 script recycle bin validation — 2026-11-15

Branch: `feature/m1-script-recycle-bin`, based on main `a1f1456` (PRs through #24 merged; no open PRs found at run start). No AGENTS.md was present in the checkout. Owner review exception remains recorded in [development authorization](DEVELOPMENT-AUTHORIZATION.md). No governance protection, CI schedule/matrix, branding, release or publishing change.

Implemented script delete/restore only. The first delete confirms explicit v2 migration, retains an exact pre-upgrade v1 manifest, and commits a complete deleted Script record with the same ID and source reference. Source files are never removed. Restore takes an explicit name/destination and refuses stale revisions, external changes and collisions. Trash is counted in manifest limits; existing operations preserve it. Folder subtree delete/restore remains the next batch.

Local results on Linux, .NET SDK 10.0.404 and existing lockfile-matching dependencies:

- `dotnet build src/Sun.Workspace.Host -c Release`: passed, zero warnings/errors.
- `npm run typecheck` and `npm run build`: passed.
- `npm test`: 14 passed, zero failures/skips; includes consent/revision/request bounds and response correlation.
- `npm run test:host` with explicit development SDK executable: 29 passed, zero failures/skips. New coverage: v1 byte preservation without consent, exact migration checkpoint, stable IDs/metadata/source after restart and restore, hidden deleted read/save/copy, trash preservation across ordinary mutations, stale hash/revision and external source conflicts, restore collision resolution, malformed/unknown schema metadata, combined script limits, mismatched backup protection and exhausted-revision rejection.
- `npm run smoke:workspace -- --ozone-platform=headless --disable-gpu`: passed through real Electron/React/Monaco/bridge/host. New coverage: dirty deletion disabled, cancelled native upgrade/delete leaves disk/editor intact, v2 upgrade with exact checkpoint, close/reopen recycle bin, failed restore-name collision leaves metadata unchanged, successful restore keeps original identity/content. Existing organizer/editor checks also passed.

Recovery test explicitly constructs a completed v1 backup and partial candidate-manifest temp before restarting; committed v1 remains readable and deletion can subsequently finish. This is simulated interruption state, not injected power loss or a new abrupt-death timing guarantee. The pre-existing abrupt host-death folder-copy test also passed. No runner/execution/cancellation code is added.

No new Windows workflow, packaged desktop, interactive clean-machine, accessibility, full backup/restore or power-loss acceptance was run. The M0 Windows foundation result is not evidence for this new organizer feature. Manual final product review and all unverified gates remain open. V2 workspaces cannot be opened by older builds; pre-upgrade metadata is not a current full backup or automatic downgrade.
