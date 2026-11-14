# ASTELVO milestones

Updated 2026-11-14. [Full roadmap](../ASTELVO%20Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | Automated Windows foundation acceptance passed; interactive/clean-machine and governance gates remain open |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | In progress — workspace/folder/script persistence in open PR #14; folder moves in draft #15; script duplication in stacked draft; organizer Windows, folder duplication and delete/restore, tags/search and backup/import/export acceptance open |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | Planned |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |


## Next delivery

PR #14 remains open with green CI at head `95cd7e1`. Folder moves are implemented in stacked draft `feature/m1-folder-moves`, based on that PR. Review/merge #14 first, then retarget the draft to main and revalidate. See [folder move evidence](../operations/M1-FOLDER-MOVES-VALIDATION.md). Folder move CI passed in [run 43622957290](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43622957290). Script duplication is implemented in stacked draft `feature/m1-script-duplicate` on #15 ([evidence](../operations/M1-SCRIPT-DUPLICATE-VALIDATION.md)); the review order is #14 → #15 → script duplication, retargeting/revalidating each final candidate. Continue folder duplication, delete/restore, tags/collections/search and import/export/backup while Windows acceptance is pending. M0 automated foundation acceptance passed; interactive/clean-machine and review enforcement follow-ups remain open. M2–M5 are planned.

## M0 foundation evidence

The first implementation provides the Electron/React/Monaco shell, bounded information-only .NET stdio host, narrow preload API, build checks and protocol/host integration tests. See [validation](../operations/M0-VALIDATION.md). [Windows automated foundation acceptance passed](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010). M0 remains open for interactive/clean-machine and governance evidence.
