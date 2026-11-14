# ASTELVO milestones

Updated 2026-11-12. [Full roadmap](../ASTELVO%20Roadmap.md). Keep planning, merged work, CI evidence and manual validation distinct.

| Milestone | Deliverable | Exit gate | State |
|---|---|---|---|
| M0 | Template, governance, architecture ADRs, shell/IPC spike and CI | Protected repo; packaged editor reaches worker; enforcement evidence recorded | In progress — desktop/host scaffold prepared; build and IPC tests pass; desktop/Windows acceptance pending |
| M1 | Organizer and durable workspace | Folders/tags/collections/search persist; import/export, recovery and restore pass | Planned |
| M2 | Everyday editor | Tabs, formatting, search/replace, recovery and external-edit conflicts work | Planned |
| M3 | JavaScript/Python Try It | Snapshot execution, stdin, stop/timeout/tree cleanup and bounded output pass | Planned |
| M4 | C# and reusable recipes | Compile/run diagnostics, saved inputs/arguments and examples work | Planned |
| M5 | Desktop v1 packaging and acceptance | Clean-machine install, restore, accessibility and documented limitations pass | Planned |
| M6 | Provider expansion | One real additional target validates extension contracts | Future, outside v1 |


## Next delivery

Complete M0 with reviewed shell/IPC/storage ADRs and a minimal desktop/host scaffold. M0 requires packaged spike, CI and governance evidence; M1–M5 remain planned.

## M0 foundation evidence

The first implementation provides the Electron/React/Monaco shell, bounded information-only .NET stdio host, narrow preload API, build checks and protocol/host integration tests. See [validation](../operations/M0-VALIDATION.md). M0 remains incomplete until desktop launch, self-contained worker/packaging and governance gates are validated.
