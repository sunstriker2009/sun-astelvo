# WORKBENCH continuation and unfinished work

Checkpoint: 2026-11-15 (America/Toronto). This is the restart entry point when the previous chat or memory is unavailable.

## Operating state: paused

The owner paused WORKBENCH development until explicitly resumed. The historically named hourly **ASTELVO Development** task was verified disabled during this documentation handoff. Archiving a chat, clearing memory, reading this file or merging this documentation does not resume implementation or the schedule. The naming migration does not resume implementation or scheduling.

After an explicit resume, follow [development authorization](DEVELOPMENT-AUTHORIZATION.md): feature branches and PRs, CI-gated squash auto-merge, manual product review deferred until the final product. Required GitHub checks and enforced approvals still apply; no self-approval or protection bypass. Release publication requires a separate deliberate decision. Do not automatically recreate or enable a schedule merely because a new thread starts.

## Verified repository checkpoint

- Repository: [sunstriker2009/sun-workbench](https://github.com/sunstriker2009/sun-workbench), product SUN-002, capability `Sun.Workspace`.
- Inspected main: [29060a8f69015bb6825e8c58c4d46a02ce3c1467](https://github.com/sunstriker2009/sun-workbench/commit/29060a8f69015bb6825e8c58c4d46a02ce3c1467).
- No open PRs or issues were returned before this handoff PR was created. Re-query on restart.
- [PR #38](https://github.com/sunstriker2009/sun-workbench/pull/38) merged as `c7eb8fd7`: cancellation-test race fix, no production change. [CI](https://github.com/sunstriker2009/sun-workbench/actions/runs/43761695295) passed.
- [PR #39](https://github.com/sunstriker2009/sun-workbench/pull/39) merged: shared FOUNDRY branding ZIP installation and uploaded Workbench artwork. Do not restore older assets from chat memory. At that checkpoint the product was still ASTELVO/SUN-002; the artwork change itself did not rename it. The owner subsequently approved WORKBENCH (same SUN-002). App-specific branding copies and rollback pilot are separate follow-ups.
- Main [CI run 43793054504](https://github.com/sunstriker2009/sun-workbench/actions/runs/43793054504) passed. Main push CI skips application build jobs; it is not fresh full application acceptance. The final #39 PR [CI run](https://github.com/sunstriker2009/sun-workbench/actions/runs/43791414327) passed separately.

This checkpoint is historical after later commits. Live repository contents, PR/check state and newer owner instructions take precedence. No application tests or Windows acceptance were rerun for this documentation audit.

## What is implemented

| Area | Merged baseline | Important limit |
|---|---|---|
| Foundation | Electron/React/Monaco, .NET 10 host, framed stdio, portable staging and short Linux CI | Windows-first; portable preview is unsigned, not an installer release |
| Organizer (M1) | Workspace writer lease and versioned manifests; stable folder/script identities; move/copy; recycle/restore; tags/favourites; saved metadata collections; loose JS/Python/C# import; verified snapshot export/fresh-folder restore | Source-word index is bounded and in memory; collection filters are a baseline |
| Editor (M2) | Tabs with independent drafts/undo; find/replace/commands; manual recovery checkpoints; opt-in automatic checkpoints; bundled JS/Prettier, Python/Ruff WASM and C#/Roslyn formatting | Format is explicit and undoable; only Save commits canonical source; recovery checkpoints are excluded from archives |
| Execution (M3/M4) | Architecture proposal only; formatter process cleanup provides experience, not a completed runner | No JavaScript, Python or C# script runner exists |
| Release (M5) | Foundation Windows automated portable evidence exists | Current-feature Windows, clean-machine and final human acceptance remain open |

Use the [master checklist](../roadmap/MASTER-CHECKLIST.md) for item state and evidence; [milestones](../roadmap/MILESTONES.md) for delivery order; [architecture roadmap](../WORKBENCH-Roadmap.md) for design intent. Evidence files under this directory record the actual validation and its limits.

## Next delivery after resume

The next major feature milestone is **M3: JavaScript/Python Try It**. M1/M2 are partially implemented, not complete; carry their remaining items alongside runner work.

1. Recheck live main/open PRs, owner instructions and SUN policy. Read the workspace format, local development guide and ADRs, especially [ADR-003](../adr/0003-local-execution.md) and [ADR-012](../adr/0012-csharp-formatting.md).
2. First coherent M3 batch: runtime discovery/explicit executable selection and a setup view separating edit, format and run availability. Missing Node/Python must not block editing or bundled formatting. Record executable/version and give actionable missing-runtime guidance; no automatic install or PATH changes.
3. Implement a shared supervisor and validated run protocol, then Node/Python adapters. Run an immutable whole-buffer snapshot in a fresh owned external process with structured arguments, explicit stdin/working directory, runtime/version and revision identity.
4. Add bounded stdout/stderr, exit/status/duration UI, cancellation/deadline and verified process-tree cleanup. Cover infinite loops, child processes, output floods, concurrent edits, missing/invalid runtimes and shutdown. Evaluate Windows Job Objects; do not declare Windows termination proven by Linux tests.
5. Continue M4 C# SDK discovery/file-based compile-run, diagnostics/source mapping, explicit dependency/restore policy, recipes/named inputs/expected output and standard-library examples. Then complete M5 packaging and acceptance.

The detailed execution design proposes a 30-second default timeout, one active run per tab and a small global concurrency bound; confirm these during implementation. User scripts run with user OS permissions. Process separation and renderer isolation are not a security sandbox. Never execute on import/open/restore/format or silently retry failed runs/install dependencies.

## Remaining v1 work and gates

| Area | Still unfinished |
|---|---|
| M0 governance | Reconcile older local adoption notes with newer FOUNDRY/SUN governance evidence; verify exact live required checks, sensitive-change review and failed-CI blocking before marking gates complete. This audit did not inspect rulesets or change settings |
| M1 storage/search | Rebuildable persistent SQLite catalog/index; multiple-tag/recency/source-query collection extensions; performance acceptance; useful no-network standard-library examples |
| M1 data safety | Current organizer/import/archive restore on Windows/clean machine; preserve explicit schema migrations, source identities, external-change checks and recovery behavior |
| M2 editor | Separate edit/format/run indicators and runtime setup; full keyboard/focus/accessibility, find/replace/undo and external-conflict acceptance |
| M2 durability/formatting | Full shutdown/power-loss and recovery checks; all three formatters on Windows/packaged build; compiled-dependency/license review |
| M3/M4 | All runtime discovery, runners, output/supervision, recipes and execution acceptance described above |
| M5 | Clean-machine installer/start/uninstall with runtimes present/missing, relocation/restore, themes/accessibility, startup/memory/output budgets, dependency review, guide/release notes/SemVer, signing/update decision and final owner product review |

The proposed search goal is 10,000 metadata records with warm p95 below 300 ms on a documented Windows reference machine. Agree the measurement protocol before accepting it; this is not a measured result.

The M0 [Windows foundation run 43609933010](https://github.com/sunstriker2009/sun-workbench/actions/runs/43609933010) at `517277cbee5bd958748d5e5a25bb77c1a2c81cb1` does not validate later organizer/editor/formatter changes. [C# evidence](M2-CSHARP-FORMAT-VALIDATION.md) reports 41 frontend tests and 65 host tests against development and self-contained Linux builds plus headless desktop checks. Its Linux headless launch used `--no-sandbox`; do not call that packaged renderer-sandbox or Windows acceptance.

No unavailable manual/Windows gate should prevent independent authorized implementation after resume, but it must remain visibly open.

## Future work outside v1

M6 covers optional execution providers: SQL Server/PostgreSQL connections, Kubernetes forwarding and other targets. Debugger, TTY/terminal, persistent REPL state, arbitrary selection execution, multi-file projects, team/cloud sync, AI execution, public plugin marketplace and automatic dependency installation are deferred. Archive merge/history retention are optional enhancements; current exports contain committed current state, not all revisions or recovery checkpoints.

Do not expand scope to these items to avoid completing M1–M5. See the roadmap for design details. Shared branding installer/rollback development belongs primarily in FOUNDRY; Future product identity changes require explicit owner approval.

## Restart procedure and validation

Use [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) and current `package.json`/workflows for commands. Recreate the checkout if transient files are gone; GitHub is durable state. Baseline development uses Node.js 24 and .NET 10 SDK.

Keep required Linux backend/frontend/title/repository checks, batch related changes and cancel superseded runs. Use local focused validation; keep Windows portable acceptance manual at meaningful milestones. Do not add hourly CI or an OS matrix or weaken gates to save quota. A docs-only handoff does not require repeating application tests, but configured PR checks still apply.

For each resumed batch, update checklist/milestones and a focused evidence file, separating implemented, merged, tested, unverified and blocked. At v1 handoff distinguish merged work, outstanding PRs and required human acceptance. Do not claim completion while acceptance remains unverified.

## Starter for a new thread

> Resume WORKBENCH development in sunstriker2009/sun-workbench from docs/operations/CONTINUATION.md. Verify current main, open PRs/checks, latest owner instructions, roadmap/checklist, ADRs and SUN governance before changing code. Continue the next unfinished v1 batch, beginning with M3 runtime discovery/capability setup unless newer repository evidence changes the order, while retaining all open M1/M2 and acceptance work. Use feature branches and CI-gated squash auto-merge under the recorded review exception; I will review the final product. Do not bypass checks or publish a release. This resumes implementation for this request; ask separately only if you need a decision about scheduling future runs.
