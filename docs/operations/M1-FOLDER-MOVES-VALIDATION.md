# M1 folder move validation — 2026-11-14

Status: implemented and locally validated in `feature/m1-folder-moves`, a stacked draft on open [PR #14](https://github.com/sunstriker2009/sun-astelvo/pull/14), head `95cd7e1ab0bbedbaab91f929a7eff4750c9718f3`. This is not merged work or completion of M1. No AGENTS.md was found in repository search; SUN Git Workflow policy applies.

## Behavior and integrity

Move a selected logical folder to another parent or the root. The renderer excludes self and descendants; the .NET host separately validates cycles, missing identities and case-insensitive sibling collisions. Existing manifest hash checks and atomic replacement protect the commit. Script identities, revision references, source bytes and editor buffers are retained. A no-op checks freshness but does not write or increment the revision. Schema remains v1; unknown metadata is still rejected rather than dropped.

The renderer receives one explicit `moveFolder` bridge method; existing sender checks and exact request/result validation remain. This extends filesystem/IPC behavior and requires human review. No CI definition, dependency, branding, execution or release changes.

## Local evidence

Validated from freshly fetched PR-head source in an isolated workspace on Linux x64 using Node 24.22.1 and .NET SDK 10.0.404:

- `dotnet build Sun.Workspace.slnx -c Release`: passed, zero warnings/errors.
- `npm run typecheck`, `npm test`, `npm run build`: passed; 11 protocol/client/startup/package-layout tests.
- `npm run test:host` with the development host: all 15 tests passed. New cases cover nested moves, root moves, reopen persistence, script/source identity, subsequent dirty-buffer save, cycles, nonexistent parent/folder, duplicate sibling names, byte-for-byte preservation after failures, no-op revision stability and external metadata conflicts.
- Published a fresh self-contained Linux host; all 15 host tests passed again with `ASTELVO_HOST_EXECUTABLE`, empty PATH and invalid installed runtime root through the test harness.
- `npm run smoke:workspace -- --ozone-platform=headless --disable-gpu`: passed against real Electron/Monaco and the development host. Covers move to another parent and back while dirty, no discard prompt, unchanged saved script metadata, retained dirty text, cancelled quit/host preservation, keyboard save/reopen and external revision adoption. Renderer sandbox and web security remained enabled. Initial added text assertion needed Monaco nonbreaking-space normalization; corrected and full flow passed.
- Inspected the resulting 900-pixel-wide editor screenshot. `git diff --check` passed.

No Windows workflow, packaged application rebuild, interactive desktop/clean-machine check or governance-settings mutation was performed for this batch. Existing manual-only Windows acceptance automatically exercises the extended workspace smoke when deliberately dispatched. No additional automatic Windows runs or matrices were added.

## Remaining gates

Review and merge PR #14 before retargeting this stacked draft to main; refresh required CI on the final merge candidate. Human filesystem/IPC review and new organizer Windows acceptance remain open. The M0 Windows baseline [run 43609933010](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010) applies only to foundation commit `517277c`, not these organizer changes. Interactive/clean-machine and governance enforcement follow-ups are distinct open gates.

Duplicate/delete/restore, tags/favourites/collections/search, safe import/export and backup/restore, M2–M5 and release acceptance remain unfinished. Local scripts will use the user's OS permissions; renderer isolation does not sandbox script execution.
