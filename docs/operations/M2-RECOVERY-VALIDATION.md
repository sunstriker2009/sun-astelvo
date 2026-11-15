# M2 manual draft checkpoints — local evidence, 2026-11-15

Implemented on `feature/m2-draft-checkpoints` from merged tabs PR #32 (`6d396514`). Live GitHub showed no overlapping implementation PR. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) permits CI-gated squash auto-merge and defers human review to final product acceptance. [ADR-008](../adr/0008-draft-checkpoints.md) records the independent recovery format, bounds and limitations.

## Validation actually run

- .NET SDK 10.0.404 Release host build, zero warnings/errors; TypeScript and renderer builds passed.
- 21 frontend/protocol/portable-layout/startup tests passed.
- 63 real-host tests passed, with six new checkpoint tests covering exact UTF-8/BOM/CRLF/control text, base hashes/incomplete metadata/label input, reopen, unchanged canonical metadata/source, stale source saves and checkpoint tokens, duplicate/unknown/version/identity/hash rejection, corrupt and invalid UTF-8 review/discard, maximum escaped source, aggregate rejection, all 16 records, symlinks, deletion retention and archive exclusion.
- A real worker was forcibly terminated when filesystem watching observed a checkpoint staging write. Reopen recovered a complete prior or next generation, with unchanged canonical manifest/source. This is process-death evidence, not a power-loss claim.
- Externally compact checkpoint JSON that would expand beyond the response limit is rejected as a preserved invalid checkpoint; the host remains usable.
- Headless Electron foundation smoke passed with exact bridge surface, Monaco, renderer isolation and real host IPC.
- Extended headless Electron workspace acceptance passed: two dirty tabs checkpointed without source/metadata commits; renderer reload destroyed models; reopening discovered the checkpoint without auto-restoring; explicit recovery restored source/name/language/label drafts; stale base source and checkpoint-token writes were rejected; invalid recovery data was reviewed, discard cancellation preserved it, and confirmed discard retained live drafts/canonical data. Existing organizer/import/archive/tab checks remain active.

Desktop smoke selectors were narrowed to the collection's sidebar note, and tab helpers now wait for enabled controls before clicks. These preserve the existing acceptance assertions while accommodating the recovery panel and asynchronous operation completion. Test dialog overrides remain development-only.

## Acceptance still open

Check the new PR for required CI/merge state. Checkpointing is manual: timed autosave, automatic shutdown flushing and session/view-state recovery remain unfinished. Later uncheckpointed edits can be lost. The checkpoint is retained after Save/close/quit and excluded from workspace archives. Oversized recovery files need manual preservation/move-aside before checkpointing resumes. Windows organizer/editor/import/restore/recovery, full Electron/OS forced shutdown/power loss, clean-machine, installer, accessibility, governance and final product review were not run here. The M0 Windows baseline (run 43609933010 at `517277cbee5bd958748d5e5a25bb77c1a2c81cb1`) remains distinct. Formatters, runners, catalog/collection extensions/examples and remaining M1–M5 gates remain open.
