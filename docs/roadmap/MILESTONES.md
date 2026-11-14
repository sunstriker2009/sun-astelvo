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
