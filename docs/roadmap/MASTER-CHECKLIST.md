# ASTELVO master checklist

Updated 2026-11-15. **Development paused until explicit owner resume.** [Continuation guide](../operations/CONTINUATION.md) records the verified checkpoint and restart order.

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
- [x] Script recycle bin and identity-preserving restore merged in [PR #25](https://github.com/sunstriker2009/sun-astelvo/pull/25); explicit schema upgrade and conflict/recovery checks ([evidence](../operations/M1-SCRIPT-RECYCLE-VALIDATION.md)). CI passed; Windows acceptance remains open.
- [x] Folder subtree delete/restore merged in [PR #26](https://github.com/sunstriker2009/sun-astelvo/pull/26): stable IDs, explicit v3 upgrade, preserved pre-deleted state and atomic whole-tree visibility ([evidence](../operations/M1-FOLDER-RECYCLE-VALIDATION.md)). CI passed; Windows acceptance remains open.
- [x] Tags/favourites and combined folder/name/language/tag/favourite metadata filters merged in [PR #27](https://github.com/sunstriker2009/sun-astelvo/pull/27), with explicit v4 migration and preserved recycle metadata ([evidence](../operations/M1-TAGS-FAVOURITES-VALIDATION.md)); CI passed; Windows acceptance remains open.
- [x] Saved metadata collections baseline merged in [PR #28](https://github.com/sunstriker2009/sun-astelvo/pull/28), with explicit v5 migration, stable filters/identities and dormant recycled-folder scopes ([evidence](../operations/M1-COLLECTIONS-VALIDATION.md)). CI passed; Windows acceptance remains open.
- [x] Initial bounded in-memory source-word index/rebuild merged in [PR #29](https://github.com/sunstriker2009/sun-astelvo/pull/29), with source/metadata integrity checks and combined filters ([evidence](../operations/M1-SOURCE-SEARCH-VALIDATION.md)); CI passed; Windows acceptance remains open.
- [ ] Persistent SQLite catalog/index, multiple-tag/recency/source-query collection extensions and search performance acceptance.
- [x] Current-state workspace archive export and fresh-folder restore merged in [PR #30](https://github.com/sunstriker2009/sun-astelvo/pull/30), with strict preflight, verified publication and manifest-last recovery ([evidence](../operations/M1-ARCHIVES-VALIDATION.md)); CI passed; Windows acceptance remains open.
- [x] Loose UTF-8 JavaScript/Python/C# import with explicit copy conflicts and atomic batch commit merged in [PR #31](https://github.com/sunstriker2009/sun-astelvo/pull/31) ([evidence](../operations/M1-IMPORT-VALIDATION.md)); CI passed; Windows acceptance remains open.
- [ ] Windows/clean-machine import and archive restore acceptance. Archive merges/history retention remain optional future enhancements.
- [ ] Useful standard-library examples requiring no packages/network.

### M2 — Editor

- [x] Register Monaco find/replace and command palette with explicit toolbar access; TypeScript/build and real headless widget activation checks passed (2026-11-14). Full editor/Windows acceptance remains open.

- [x] In-session Monaco tabs, independent source/metadata/label drafts, language selection, shortcuts and per-model undo merged in [PR #32](https://github.com/sunstriker2009/sun-astelvo/pull/32) ([evidence](../operations/M2-TABS-VALIDATION.md)); Windows acceptance remains open.
- [ ] Full editor keyboard/focus/accessibility and Windows acceptance.
- [x] Bundled JavaScript/Prettier formatting, model undo and worker failure/cancel/deadline handling merged in [PR #35](https://github.com/sunstriker2009/sun-astelvo/pull/35) ([evidence](../operations/M2-JAVASCRIPT-FORMAT-VALIDATION.md)); Windows acceptance remains open.
- [x] Bundled Python/Ruff WASM formatting merged in [PR #36](https://github.com/sunstriker2009/sun-astelvo/pull/36) ([evidence](../operations/M2-PYTHON-FORMAT-VALIDATION.md)); Windows acceptance remains open.
- [x] Bundled C#/Roslyn adapter merged in [PR #37](https://github.com/sunstriker2009/sun-astelvo/pull/37) ([evidence](../operations/M2-CSHARP-FORMAT-VALIDATION.md), [ADR-012](../adr/0012-csharp-formatting.md)); Windows/full formatter acceptance remains open.
- [ ] Full three-formatter/Windows and compiled-dependency acceptance.
- [x] Explicit durable draft checkpoint/recovery merged in [PR #33](https://github.com/sunstriker2009/sun-astelvo/pull/33), with retained base hashes and preserved canonical data ([evidence](../operations/M2-RECOVERY-VALIDATION.md)); Windows acceptance remains open.
- [x] Opt-in timed draft checkpoints, serialized acknowledgements and normal-close/workspace-transition flush merged in [PR #34](https://github.com/sunstriker2009/sun-astelvo/pull/34) ([evidence](../operations/M2-AUTOMATIC-CHECKPOINT-VALIDATION.md)); Windows acceptance remains open.
- [ ] Full shutdown/power-loss, recovery/external-conflict and Windows acceptance.
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

### Additional merged safeguards

- [x] Script write preflight rejects exhausted revisions/manifest size before staging source files; Release build and 25 host tests passed (2026-11-14). Windows acceptance remains open.

- [x] Save preserves matching Monaco buffer undo, selection and scroll ([PR #21](https://github.com/sunstriker2009/sun-astelvo/pull/21)); full editor/Windows acceptance remains open.
- [x] C# formatter cancellation-test ordering fix merged ([PR #38](https://github.com/sunstriker2009/sun-astelvo/pull/38)); [evidence](../operations/M2-CSHARP-FORMAT-VALIDATION.md).

Historical per-batch progress paragraphs were consolidated into the completed items and their linked evidence above. Do not use an older evidence file's “next” sentence as the current queue. Current next milestone and limits are in the [continuation guide](../operations/CONTINUATION.md).
