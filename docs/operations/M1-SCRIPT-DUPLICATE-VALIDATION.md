# M1 script duplication validation — 2026-11-14

Status: implemented and locally validated in `feature/m1-script-duplicate`, stacked on open draft [PR #15](https://github.com/sunstriker2009/sun-astelvo/pull/15), head `1a24b421ccb2b07642065cb41d5f46d4e1b9798f`. Parent PR #14 also remains open. This is not merged work or completion of M1. PR #15 CI [run 43622957290](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43622957290) passed; this is separate from new duplication validation below. Repository search found no AGENTS.md. SUN governance still requires human review of filesystem/IPC changes.

## Behavior

Duplicate the current saved script to an explicit name and destination. The copy has a fresh GUID and independent source directory; language, exact content bytes and hash are preserved. The original metadata/source is unchanged. Dirty buffers and loaded external edits disable the form until saved. The host also checks the expected hash against the committed reference and on-disk source, so an external edit cannot be silently copied.

Missing destinations, sibling-name collisions, invalid UTF-8, stale source/metadata and catalog limits reject the operation. Staging uses existing copy-on-write storage and the atomic manifest replacement commit point. A late failure/interruption can leave an ignored, preserved orphan copy; uncertain responses require refresh/inspection before retry. Schema remains v1 with no new fields or migration. The renderer gets one explicit bridge method; paths, source overrides and arbitrary IPC remain unavailable. No runner, dependency, branding, CI definition or release changes.

## Local evidence

Freshly fetched PR-head text sources were validated in an isolated Linux x64 workspace with a newly installed .NET SDK 10.0.404, Node 24.22.1 and lockfile-installed npm dependencies:

- .NET Release build passed with zero warnings/errors.
- TypeScript check, renderer build and 12 protocol/client/startup/package-layout tests passed, including duplicate request/result correlation and rejection of path/content overrides.
- Development real-host suite: all 19 tests passed. New duplication cases covered JavaScript/Python/C#, Unicode/CRLF and maximum-size escaped content, new identities, independent edit/reopen persistence, name/destination/source/metadata conflicts, script-count limits and invalid UTF-8.
- Fresh self-contained Linux host: all 19 tests passed with the harness removing PATH and pointing at an invalid installed runtime. This also includes duplication through a managed symlink/junction being rejected without writing the target, and a simulated staged orphan copy being ignored/preserved across restart. This simulation is not fault-injected power-loss acceptance.
- Real headless Electron/Monaco flow passed via `npm run smoke:workspace -- --ozone-platform=headless --disable-gpu`: duplicate-name failure preserves manifest/current document, a copy to root opens and reopens, the original metadata is unchanged, dirty/unadopted-external duplication is disabled, and existing folder move/save/quit checks still pass. Sandbox and web security remain enabled.
- Reviewed the resulting 900-pixel-wide editor screenshot; `git diff --check` passed.

No packaged application rebuild, Windows run, interactive desktop/clean-machine test, governance mutation or release publication was performed in this batch. The existing manual-only Windows workflow exercises the extended editor flow when intentionally dispatched; no schedules or matrix were added.

## Remaining acceptance

Review/merge in stack order: #14, #15, then script duplication. Retarget and revalidate the final main merge candidate after parent squash merges. Human filesystem/IPC review, new organizer Windows acceptance, interactive/clean-machine and governance enforcement gates remain open. M0 Windows baseline run 43609933010 applies to foundation commit `517277c`, not these organizer changes.

Folder duplication, delete/restore, tags/favourites/collections/search, import/export and backup/restore remain unfinished, as do M2–M5. Script execution is still unavailable; eventual scripts run with the user's OS permissions, and renderer isolation is not a script security sandbox.
