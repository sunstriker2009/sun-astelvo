# ASTELVO master checklist

[Full roadmap](../ASTELVO%20Roadmap.md). Record PRs and validation evidence beside completed items.

### M0 — Foundation

- [x] Product name, ID and revised tagline approved.
- [x] Inspect SUN template/provisioner and ORYVA milestone format; draft revised baseline.
- [x] Generate product repository from template: `sunstriker2009/sun-astelvo`, public, `main`. Template files inspected; branch reports protected.
- [ ] Discover exact template CI checks; plan/apply/verify governance and test failed-CI blocking.
- [ ] Enforce sensitive-change review and real CODEOWNERS separately from baseline bootstrap.
- [ ] ADR-001 shell/IPC; ADR-002 storage/recovery; ADR-003 local execution boundary.
- [ ] .NET 10 solution, UI skeleton, dependency locks, worker lifecycle and packaged Monaco spike.
- [ ] Add short backend/frontend CI with stable check names and concurrency cancellation.

### M1 — Organizer

- [ ] Workspace create/open, manifest schema, writer lease and recoverable writes.
- [ ] Script/folder CRUD, move, duplicate, delete/restore and stable IDs.
- [ ] Tags, favourites, smart collection filters and indexed search.
- [ ] Safe import/export, index rebuild and backup/restore.
- [ ] Useful standard-library examples requiring no packages/network.

### M2 — Editor

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

