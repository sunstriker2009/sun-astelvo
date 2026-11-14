# ASTELVO milestones

Updated 2026-11-14. [Full roadmap](../ASTELVO%20Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | Automated Windows foundation acceptance passed; interactive/clean-machine and governance gates remain open |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | In progress — first workspace/folder/script persistence slice implemented; organizer Windows, remaining CRUD, tags/search and backup/import/export acceptance open |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | Planned |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |


## Next delivery

Validate the first organizer slice on Windows, then continue remaining M1 CRUD, tags/collections/search and import/export/backup work. M0 automated foundation acceptance passed; interactive/clean-machine and review enforcement follow-ups remain open. M2–M5 are planned.

## M0 foundation evidence

The first implementation provides the Electron/React/Monaco shell, bounded information-only .NET stdio host, narrow preload API, build checks and protocol/host integration tests. See [validation](../operations/M0-VALIDATION.md). [Windows automated foundation acceptance passed](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010). M0 remains open for interactive/clean-machine and governance evidence.
