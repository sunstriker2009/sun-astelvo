# ASTELVO milestones

Updated 2026-11-14. [Full roadmap](../ASTELVO%20Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | Automated Windows foundation acceptance passed; interactive/clean-machine and governance gates remain open |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | In progress — persistence, folder moves and script duplication merged (#14–#16); folder subtree duplication merged (#18); script recycle bin merged (#25); folder delete/restore merged (#26); tags/favourites merged (#27); saved metadata collections merged (#28); source-word session index merged (#29); snapshot export/fresh restore merged (#30); loose-source import merged (#31); Windows organizer, persistent catalog, collection extensions and remaining editor/runner acceptance open |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | In progress — in-session tabs locally validated; formatting/recovery and Windows gates open |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |


## Next delivery

Main `1e3d5706` contains merged loose-source import PR #31; no open implementation PR overlapped this batch.

M2 in-session editor tabs are locally implemented/validated in `feature/m2-editor-tabs` ([evidence](../operations/M2-TABS-VALIDATION.md), [ADR-007](../adr/0007-editor-tabs.md)). Each tab retains source/metadata/label drafts and undo; inactive drafts participate in workspace/quit and export/bulk-folder guards. Capacity is checked before persistent creation. Check the new PR for CI/merge state. Apply [owner-authorized CI-gated auto-merge](../operations/DEVELOPMENT-AUTHORIZATION.md); final product review remains required.

Persistent catalog, collection extensions, examples and remaining M2–M5 formatting/recovery/runner/packaging work remain unfinished. Tabs are memory-only; unsaved crash recovery is not delivered. Windows organizer/editor/import/restore, clean-machine and governance follow-ups stay distinct from M0. Archive merges/history retention remain optional future enhancements.

## M0 foundation evidence

The first implementation provides the Electron/React/Monaco shell, bounded information-only .NET stdio host, narrow preload API, build checks and protocol/host integration tests. See [validation](../operations/M0-VALIDATION.md). [Windows automated foundation acceptance passed](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010). M0 remains open for interactive/clean-machine and governance evidence.


## Script write preflight follow-up — 2026-11-14

Folder duplication merged in PR #18. Script create/save/duplicate now validate the next revision and serialized manifest size before writing source revisions, matching the bulk-copy preflight. This prevents unnecessary orphan files when revision or metadata limits already prohibit committing. Release build passed with zero warnings/errors; all 25 development-host integration tests passed, including exhausted-revision rejection with byte-identical manifest and unchanged source directories/revisions. No new Windows, packaged desktop or power-loss acceptance was run. Delete/restore remains the next organizer feature.


## Editor commands slice — 2026-11-14

Find/replace and command palette contributions are now registered explicitly in the modular Monaco build, with Find, Replace and Commands toolbar buttons disabled when no script is open or work is pending. Monaco supplies its normal editor keybindings. TypeScript and renderer builds passed; the real headless Electron workspace acceptance opened all three widgets and dismissed them with Escape while retaining existing workspace/save/copy checks. This validates activation, not exhaustive search-option or replacement/undo acceptance. No new Windows or packaged-desktop run occurred. Tabs, formatting, recovery, full editor acceptance and organizer delete/restore remain open.


### Save buffer preservation — 2026-11-14

Saving the current document no longer calls Monaco setValue when its content already matches the committed response. This retains the undo stack, selection and scroll while updating saved metadata and dirty state. Document switches and changed reload content still reset the buffer. Local TypeScript and renderer builds passed. Desktop undo/redo, Windows and manual acceptance were not run for this slice and remain open. Organizer delete/restore and remaining M1–M5 work remain unfinished. Owner-authorized CI-gated squash auto-merge applies.


### Script recycle bin — 2026-11-15

Implemented on `feature/m1-script-recycle-bin`: recoverable script deletion, explicit v1-to-v2 upgrade with exact metadata checkpoint, retained source revisions and identity-preserving restore with name/destination conflict handling. Release build, TypeScript/renderer builds, 14 frontend/protocol tests, 29 real-host tests and headless Electron workspace acceptance passed. [Detailed evidence](../operations/M1-SCRIPT-RECYCLE-VALIDATION.md). Owner-authorized CI-gated squash auto-merge applies; merge/CI state must be checked on the PR. Folder subtree delete/restore is next. Windows organizer, interactive/clean-machine, final product review and remaining M1–M5 gates remain open; the M0 Windows baseline is unchanged.


### Folder subtree recycle bin — 2026-11-15

Locally implemented/validated in `feature/m1-folder-recycle`: atomic folder subtree delete/restore, explicit v3 upgrade/checkpoint, original IDs/source files and preservation of previously deleted script state. Release/TypeScript/renderer builds, 15 frontend/protocol tests, 34 distinct real-host tests and headless Electron workspace acceptance passed ([evidence](../operations/M1-FOLDER-RECYCLE-VALIDATION.md)). Check the new PR for required CI/merge state. Owner-authorized squash auto-merge applies. Windows organizer, interactive/clean-machine, final human product review and remaining M1–M5 gates stay open. Tags/favourites/collections/search is next.


### Tags and favourites — 2026-11-15

Locally implemented/validated in `feature/m1-tags-favourites`: explicit v4 migration/checkpoint, persisted classification across active/deleted scripts and folder trash, and combined metadata filters. Release/TypeScript/renderer builds, 16 frontend/protocol tests, 38 real-host tests and headless Electron workspace acceptance passed ([evidence](../operations/M1-TAGS-FAVOURITES-VALIDATION.md)). Check the new PR for CI/merge state. Owner-authorized squash auto-merge applies. Saved collections/indexed search and remaining M1–M5, Windows/clean-machine and final product acceptance stay open.


### Saved collections baseline — 2026-11-15

Locally implemented/validated in `feature/m1-saved-collections`: explicit v5 migration/checkpoints, saved folder/name/language/single-tag/favourite definitions, create/update/delete and stable dormant recycled-folder scopes. Release/TypeScript/renderer builds, 17 frontend/protocol tests, 42 real-host tests and headless Electron workspace acceptance passed ([evidence](../operations/M1-COLLECTIONS-VALIDATION.md)). Check the new PR for CI/merge state. Owner-authorized squash auto-merge applies. Indexed source search/index rebuild, multiple-tag/recency collection extensions and remaining M1–M5/Windows/clean-machine/final product gates stay open.


### Initial source-word index — 2026-11-15

Locally implemented/validated in `feature/m1-source-search`: bounded read-only session index, whole-word Unicode AND, explicit rebuild, source/metadata freshness checks and combined metadata/collection filters. Release/TypeScript/renderer builds, 18 frontend/protocol tests, 47 real-host tests and headless Electron acceptance passed ([evidence](../operations/M1-SOURCE-SEARCH-VALIDATION.md)). Check the new PR for CI/merge state. Owner-authorized squash auto-merge applies. Persistent SQLite catalog, collection extensions, safe import/export/full backup and remaining M1–M5/Windows/performance/final product gates remain open.


### Workspace snapshot archives — 2026-11-15

Locally implemented/validated in `feature/m1-workspace-archives`: verified no-overwrite export, strict archive preflight and fresh-folder manifest-last restore preserving exact current metadata/source/recycle state. Release/TypeScript/renderer builds, 19 frontend/protocol tests, 52 distinct host tests and headless Electron acceptance passed ([evidence](../operations/M1-ARCHIVES-VALIDATION.md)). Check the new PR for CI/merge state. Owner-authorized squash auto-merge applies. Loose imports/merge, history/retention, persistent catalog and remaining M1–M5/Windows/clean-machine/power-loss/final product gates stay open.


### Loose-source import — 2026-11-15

Locally implemented/validated in `feature/m1-loose-script-import`: native-selected JS/Python/C# UTF-8 copy, exact bytes/new IDs, explicit numbered name conflicts and single-commit complete-batch visibility. Release/TypeScript/renderer builds, 20 frontend/protocol tests, 57 host tests and headless Electron acceptance passed ([evidence](../operations/M1-IMPORT-VALIDATION.md)). Check the new PR for CI/merge state. Owner-authorized squash auto-merge applies. Persistent catalog, collection extensions/examples and remaining M1–M5/Windows/clean-machine/final product gates stay open.
