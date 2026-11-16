# WORKBENCH milestones

Updated 2026-11-15. **Paused until explicit owner resume.** [Continuation guide](../operations/CONTINUATION.md). [Full roadmap](../WORKBENCH-Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | Automated Windows foundation acceptance passed; interactive/clean-machine and governance gates remain open |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | In progress — persistence, folder moves and script duplication merged (#14–#16); folder subtree duplication merged (#18); script recycle bin merged (#25); folder delete/restore merged (#26); tags/favourites merged (#27); saved metadata collections merged (#28); source-word session index merged (#29); snapshot export/fresh restore merged (#30); loose-source import merged (#31); Windows organizer, persistent catalog, collection extensions and remaining editor/runner acceptance open |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | In progress — tabs/recovery/automatic checkpoints/all three formatters merged (#32–#37); Windows and full acceptance open |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |

## Next delivery after resume

**M3 runtime discovery and explicit executable selection**, with a setup view distinguishing edit/format/run capabilities, is the next major feature batch. Then implement shared supervision/protocol and JavaScript/Python execution, followed by M4 C#/recipes and M5 release acceptance.

M1/M2 remain open for persistent SQLite indexing, richer collections/examples, capability setup and the full Windows/editor/recovery/formatter acceptance described in the [master checklist](MASTER-CHECKLIST.md). Do not mark them complete merely because runner implementation begins.

## Verified checkpoint and evidence

At this handoff, main was `29060a8f69015bb6825e8c58c4d46a02ce3c1467`, with no open PRs/issues before the handoff PR. Formatter PR #37 and cancellation-test follow-up #38 are merged; branding installer/artwork PR #39 is also merged. See [continuation](../operations/CONTINUATION.md) for exact links, CI limitations, pause status and a new-thread starter.

- [M0 Windows foundation acceptance](https://github.com/sunstriker2009/sun-workbench/actions/runs/43609933010) validates the older foundation only.
- M1 completed-item evidence is linked from the [checklist](MASTER-CHECKLIST.md): move/copy/recycle, tags/collections/search, import and archive restore.
- M2 evidence covers [tabs](../operations/M2-TABS-VALIDATION.md), [recovery](../operations/M2-RECOVERY-VALIDATION.md), [automatic checkpoints](../operations/M2-AUTOMATIC-CHECKPOINT-VALIDATION.md), [JavaScript](../operations/M2-JAVASCRIPT-FORMAT-VALIDATION.md), [Python](../operations/M2-PYTHON-FORMAT-VALIDATION.md) and [C#](../operations/M2-CSHARP-FORMAT-VALIDATION.md).
- C# evidence records 41 frontend tests, 65 host tests against both Linux host builds and headless checks, with explicit sandbox/Windows/manual limitations. No application suites were repeated for the documentation handoff.

Current-feature Windows/clean-machine, shutdown/power-loss, accessibility/performance, compiled-dependency review, governance verification and final owner acceptance remain open. Saved-state archives exclude draft recovery checkpoints. Archive merge/history is optional later work; M6 provider expansion remains outside v1.

Historical batch logs remain available in Git history and focused validation files. The checklist and continuation guide supersede their old “next” statements.
