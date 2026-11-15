# ASTELVO milestones

Updated 2026-11-14. [Full roadmap](../ASTELVO%20Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | Automated Windows foundation acceptance passed; interactive/clean-machine and governance gates remain open |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | In progress — persistence, folder moves and script duplication merged (#14–#16); folder subtree duplication locally validated; Windows organizer, delete/restore, tags/search and backup/import/export acceptance open |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | Planned |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |


## Next delivery

PRs [#14](https://github.com/sunstriker2009/sun-astelvo/pull/14), [#15](https://github.com/sunstriker2009/sun-astelvo/pull/15) and [#16](https://github.com/sunstriker2009/sun-astelvo/pull/16) are merged. Main `8bf8a52` has the same tree as the validated script-duplication head. Folder moves were reconciled with the squash-merged foundation without rewriting branch history; the refreshed CI passed in [run 43634097751](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43634097751).

Folder subtree duplication is implemented in `feature/m1-folder-duplicate`, directly on that main tree ([evidence](../operations/M1-FOLDER-DUPLICATE-VALIDATION.md)). Apply [owner-authorized CI-gated auto-merge](../operations/DEVELOPMENT-AUTHORIZATION.md) to this and subsequent ready implementation PRs. The former review-ready stack is complete; delete/restore is the next organizer batch, followed by tags/collections/search and import/export/backup.

New organizer Windows, interactive/clean-machine and governance enforcement follow-ups remain open and distinct from the M0 baseline. M2–M5 are planned; final manual product acceptance remains required.

## M0 foundation evidence

The first implementation provides the Electron/React/Monaco shell, bounded information-only .NET stdio host, narrow preload API, build checks and protocol/host integration tests. See [validation](../operations/M0-VALIDATION.md). [Windows automated foundation acceptance passed](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010). M0 remains open for interactive/clean-machine and governance evidence.


## Script write preflight follow-up — 2026-11-14

Folder duplication merged in PR #18. Script create/save/duplicate now validate the next revision and serialized manifest size before writing source revisions, matching the bulk-copy preflight. This prevents unnecessary orphan files when revision or metadata limits already prohibit committing. Release build passed with zero warnings/errors; all 25 development-host integration tests passed, including exhausted-revision rejection with byte-identical manifest and unchanged source directories/revisions. No new Windows, packaged desktop or power-loss acceptance was run. Delete/restore remains the next organizer feature.


## Editor commands slice — 2026-11-14

Find/replace and command palette contributions are now registered explicitly in the modular Monaco build, with Find, Replace and Commands toolbar buttons disabled when no script is open or work is pending. Monaco supplies its normal editor keybindings. TypeScript and renderer builds passed; the real headless Electron workspace acceptance opened all three widgets and dismissed them with Escape while retaining existing workspace/save/copy checks. This validates activation, not exhaustive search-option or replacement/undo acceptance. No new Windows or packaged-desktop run occurred. Tabs, formatting, recovery, full editor acceptance and organizer delete/restore remain open.


### Save buffer preservation — 2026-11-14

Saving the current document no longer calls Monaco setValue when its content already matches the committed response. This retains the undo stack, selection and scroll while updating saved metadata and dirty state. Document switches and changed reload content still reset the buffer. Local TypeScript and renderer builds passed. Desktop undo/redo, Windows and manual acceptance were not run for this slice and remain open. Organizer delete/restore and remaining M1–M5 work remain unfinished. Owner-authorized CI-gated squash auto-merge applies.
