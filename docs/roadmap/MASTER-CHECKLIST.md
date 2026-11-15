# ASTELVO master checklist

[Full roadmap](../ASTELVO%20Roadmap.md). Record PRs and validation evidence beside completed items. [Owner development authorization](../operations/DEVELOPMENT-AUTHORIZATION.md) defers manual code review to final product acceptance and permits CI-gated squash auto-merge; configured GitHub protections remain unchanged.

### M0 — Foundation

- [x] Product name, ID and revised tagline approved.
- [x] Inspect SUN template/provisioner and ORYVA milestone format; draft revised baseline.
- [x] Generate product repository from template: `sunstriker2009/sun-astelvo`, public, `main`. Template files inspected; branch reports protected.
- [ ] Discover exact template CI checks; plan/apply/verify governance and test failed-CI blocking.
- [ ] Enforce sensitive-change review and real CODEOWNERS separately from baseline bootstrap.
- [x] Draft ADR-001 shell/IPC, ADR-002 storage/recovery and ADR-003 execution boundary. Shell is selected for the spike; packaged desktop acceptance remains pending.
- [x] .NET 10 solution, UI skeleton, npm lockfile and worker protocol/lifecycle tests.
- [x] Automated Windows portable Monaco/host and self-contained worker acceptance passed: [run](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010).
- [ ] Interactive/relocated Windows clean-machine checks; remaining governance enforcement.
- [x] Add native Windows/Linux portable staging and bundled-host selection; Linux x64 package and runtime-independent host tests pass. Windows/full desktop acceptance remains open.
- [x] Add manual-only Windows package/host/desktop acceptance and short-lived artifact; no automatic Windows CI runs.
- [x] Replace CODEOWNERS placeholder and inspect live rules read-only; document remaining enforcement gaps in M0 validation.
- [x] Add backend/frontend PR CI definitions and concurrency cancellation.
- [ ] Verify new CI runs and add exact emitted checks to protection through the reviewed adoption process.

### M1 — Organizer

- [x] Merged [PR #14](https://github.com/sunstriker2009/sun-astelvo/pull/14): native workspace create/open/close, manifest v1, exclusive writer lease, copy-on-write revisions and conflict checks; [format and limits](../architecture/WORKSPACE-FORMAT.md).
- [x] Script create/read/save/rename/language/move and folder create/rename with stable IDs; manual Ctrl/Cmd+S, dirty-buffer navigation/quit guard.
- [ ] Validate the new organizer on Windows through the extended manual acceptance workflow.
- [x] Folder move to another parent/root with stable subtree/script identities; rejects cycles, missing destinations and case-insensitive sibling collisions. Merged [PR #15](https://github.com/sunstriker2009/sun-astelvo/pull/15); [local evidence](../operations/M1-FOLDER-MOVES-VALIDATION.md). Windows organizer acceptance remains open.
- [x] Script duplication with explicit name/destination, new identity, reviewed committed content and independent source storage; merged [PR #16](https://github.com/sunstriker2009/sun-astelvo/pull/16) ([evidence](../operations/M1-SCRIPT-DUPLICATE-VALIDATION.md)). Windows acceptance remains open.
- [x] Folder subtree duplication with new identities, all-source preflight, aggregate limits and one manifest commit; merged in [PR #18](https://github.com/sunstriker2009/sun-astelvo/pull/18) ([evidence](../operations/M1-FOLDER-DUPLICATE-VALIDATION.md)); Windows acceptance remains open.
- [x] Script recycle bin and identity-preserving restore locally implemented/validated; explicit schema upgrade and conflict/recovery checks ([evidence](../operations/M1-SCRIPT-RECYCLE-VALIDATION.md)). Merge/CI and Windows acceptance remain separate.
- [ ] Folder subtree delete/restore.
- [ ] Tags, favourites, smart collection filters and indexed search.
- [ ] Safe import/export, index rebuild and backup/restore.
- [ ] Useful standard-library examples requiring no packages/network.

### M2 — Editor

- [x] Register Monaco find/replace and command palette with explicit toolbar access; TypeScript/build and real headless widget activation checks passed (2026-11-14). Full editor/Windows acceptance remains open.

- [ ] Monaco tabs, language selection, shortcuts, find/replace and command palette.
- [ ] Three formatter adapters with undo and failure handling.
- [ ] Autosave/recovery and external-change conflict handling.
- [ ] Separate edit/format/run capabilities and runtime setup view.

### M3 — JavaScript/Python

- [ ] Runtime discovery and explicit executable selection.
- [ ] Shared supervisor/protocol, cancellation, output bounds and cleanup.
- [ ] Node/Python adapters, stdin, arguments and run revision identity.
- [ ] Missing-runtime guidance; errors, output, duration and exit-code display.
- [ ] Infinite loop, child-process tree, output flood and app-shutdown acceptance.

### M4 — C# and recipes

- [ ] SDK discovery, controlled file-based compile/run and artifact cleanup.
- [ ] Diagnostics/source mapping and explicit restore/dependency behaviour.
- [ ] Saved recipes and named inputs with optional expected-output comparison.
- [ ] Standard-library examples pass the shared runner contract across all three languages.

### M5 — Release acceptance

- [ ] Clean-machine installer/start/uninstall with runtimes present and missing.
- [ ] Keyboard/focus accessibility, themes and readable results.
- [ ] Forced shutdown recovery, import conflicts and fresh-workspace restore.
- [ ] Proposed search target: 10,000 metadata records; warm p95 under 300 ms on a documented Windows reference machine. Agree measurement protocol before acceptance.
- [ ] Set startup/memory budgets from M0 measurements; verify output stress and UI responsiveness.
- [ ] Review IPC, imports, environment handling and supervision; document limits.
- [ ] Dependency/license review, guide, release notes and SemVer.
- [ ] Decide installer signing/update strategy. Publishing is a deliberate release step.

v1 acceptance: import JS/Python/C#, organize via folders and overlapping tags, save a collection, search/edit/format with undo, run saved input, stop an infinite loop without closing the app, recover an unsaved buffer and export/restore the workspace on another supported installation.

- [x] Script write preflight rejects exhausted revisions/manifest size before staging source files; Release build and 25 host tests passed (2026-11-14). Windows acceptance remains open.


### Save buffer preservation — 2026-11-14

Saving the current document no longer calls Monaco setValue when its content already matches the committed response. This retains the undo stack, selection and scroll while updating saved metadata and dirty state. Document switches and changed reload content still reset the buffer. Local TypeScript and renderer builds passed. Desktop undo/redo, Windows and manual acceptance were not run for this slice and remain open. Organizer delete/restore and remaining M1–M5 work remain unfinished. Owner-authorized CI-gated squash auto-merge applies.


### Script recycle bin — 2026-11-15

Implemented on `feature/m1-script-recycle-bin`: recoverable script deletion, explicit v1-to-v2 upgrade with exact metadata checkpoint, retained source revisions and identity-preserving restore with name/destination conflict handling. Release build, TypeScript/renderer builds, 14 frontend/protocol tests, 29 real-host tests and headless Electron workspace acceptance passed. [Detailed evidence](../operations/M1-SCRIPT-RECYCLE-VALIDATION.md). Owner-authorized CI-gated squash auto-merge applies; merge/CI state must be checked on the PR. Folder subtree delete/restore is next. Windows organizer, interactive/clean-machine, final product review and remaining M1–M5 gates remain open; the M0 Windows baseline is unchanged.
