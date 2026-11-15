# M1 tags/favourites validation — 2026-11-15

Branch `feature/m1-tags-favourites`, based on main `30651e8a62d6b73b3d8396596d006b2131c74a1e`. Folder recycle PR #26 is merged; [its CI passed](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43701017839). No open PR or AGENTS.md was found at run start. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) continues to permit CI-gated squash auto-merge and final product review. No branding, protection, CI schedule/matrix, release publication or M6 changes.

Implemented persisted Unicode tags/favourite state, explicit v4 upgrade/checkpoints across all live/recycle partitions, metadata-only revision-checked classification writes, preservation through ordinary operations, and combined folder/name/language/tag/favourite list filters. Saved collections and indexed source search are not implemented by this batch.

Local validation on Linux using .NET SDK 10.0.404 and the existing lockfile-matching dependencies:

- Release host build passed with zero warnings/errors; TypeScript and renderer builds passed.
- `npm test`: 16 passed, zero failures/skips. New contract case validates tag bounds, case-insensitive duplicates, request shape and correlated v4 responses.
- `npm run test:host`: 38 passed, zero failures/skips. New cases exercise explicit upgrades from each of v1/v2/v3 with exact checkpoint bytes; all active/script-trash/folder-trash metadata; no source writes; Unicode labels; restart; content save/language/name changes; independent script/folder copies; script/folder delete/restore without downgrading v4; defaults for new scripts; invalid tags; stale revisions/external metadata; mismatched checkpoint protection; interrupted checkpoint/temp restart state; exhausted revision; and missing/unknown/version-incompatible classification fields. Existing process-death and storage recovery cases also passed.
- `npm run smoke:workspace -- --ozone-platform=headless --disable-gpu`: passed through real Electron/React/Monaco/bridge/host. New coverage: unsaved-label quit cancellation; native upgrade cancellation leaves exact manifest bytes; v3-to-v4 checkpoint; tags/favourite persistence; unsaved label draft retained across a source save; combined case-insensitive name, language, tag, favourite and folder filters; no-result and Clear filters behaviour; close/reopen labels. Existing organizer/recycle/editor acceptance also passed.

Metadata classification intentionally never rewrites source files; the host test changes a source externally and verifies its bytes survive classification. Source adoption remains an independent reviewed Reload/Save operation. The UI requires a saved/adopted source before saving labels and guards unsaved label drafts on ordinary navigation/quit. Crash/OS-termination recovery for unsaved edits is not implemented.

No new Windows workflow, packaged desktop, clean-machine, accessibility, power-loss or search-performance acceptance was run. The existing M0 Windows baseline is distinct from new organizer acceptance. Full v1 is unfinished: saved collections/indexed search, safe import/export/full backup, editor/runners/packaging and final human review remain open.
