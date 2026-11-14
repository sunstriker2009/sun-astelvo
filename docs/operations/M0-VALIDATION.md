# M0 foundation validation

Updated 2026-11-14. This records foundation checks and a portable spike, not completed M0 or a release.

| Check | Evidence |
| --- | --- |
| .NET host Release build | SDK 10.0.404; zero warnings/errors |
| TypeScript and renderer/Monaco bundle | Passed locally |
| Node protocol/client/package/startup tests | 11 passed: prior cases plus actual entry-module import/readiness ordering; the new regression fails against the old entry and passes with deferred startup |
| Real host integration | 2 passed against development DLL and 2 against the bundled Linux executable: correlation/EOF shutdown and oversized-frame rejection |
| Runtime-independent host | Bundled-host tests clear the child PATH and set invalid DOTNET_ROOT; no installed runtime command is available |
| Production dependency audit | Zero vulnerabilities after patched DOMPurify 3.4.17 override; no dependencies added in this packaging change |
| Linux x64 portable directory | Built; self-contained .NET runtime 10.0.15 and Electron included; runtime notices retained |
| Full desktop smoke | Real Linux development and packaged headless launches passed Monaco, renderer isolation/sandbox and host IPC. Packaged headless launch used empty PATH, invalid DOTNET_ROOT and invalid developer runtime override. Interactive Windows acceptance remains pending |
| Windows portable | Second manual run built the package and passed both bundled-host tests; desktop smoke hit the 20-second startup timeout. Entry/readiness fix added; new Windows run pending |
| Installer, signing and native executable resource branding | Outside this spike; remain M5 work |
| Branch enforcement | Required repository-validation aggregates backend/frontend results; exact named check/review configuration and failed-check acceptance remain open |

## Packaging and smoke

### Fresh-install failure and fix

[Windows acceptance run 1](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43584284121) failed with ENOENT while copying `node_modules/electron/dist`. Electron 45's npm package installs its binary lazily through its CLI; packaging copied the directory directly and never triggered the download. This was a packaging bootstrap defect, not a failed .NET publish or desktop-smoke result.

The builder now invokes `node node_modules/electron/install.js` from the pinned installed package before publishing/staging, checks that the native executable exists, and propagates installer failures immediately. Existing matching installs reuse Electron's own installed/cache checks. Unit regression uses a fresh package fixture without dist and exercises installer failure and missing-output cases. A separate clean Linux dependency install without lifecycle scripts confirms that packaging prepares the real pinned runtime and completes; this does not establish Windows desktop acceptance.

After merging the fix, start a **new** manual workflow run on main. Re-running the original failed run would reuse its old commit and the old packaging code.

### Entry/readiness cycle and fix

[Windows acceptance run 2](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43587093807) built the portable directory and passed both real bundled-host tests. It then timed out during desktop startup. The old diagnostic did not identify the stalled stage.

The main ESM entry awaited `app.whenReady()` at module scope. Electron 45.3.2's [entry loader](https://github.com/electron/electron/blob/v45.3.2/lib/browser/init.ts) awaits that module import before signaling app-code completion. Startup now registers a readiness callback and finishes entry evaluation immediately; window creation still occurs only after readiness. Errors from readiness/window/page startup share the same failure handler. A child-process regression imports the actual production entry with readiness held until after import and then verifies window/page startup after release; it fails with the old entry and passes with this fix.

Real Electron headless verification also passed in both development and packaged Linux modes using `--ozone-platform=headless --disable-gpu`. The packaged check used empty PATH and invalid DOTNET_ROOT/developer override. Monaco mounted, the narrow bridge called the real bundled host, and renderer sandbox/context isolation/web security assertions passed. No security protection was disabled. This is Linux headless evidence, not interactive Windows acceptance.

Smoke now reports startup stages and the exact stage at timeout, plus preload/load/renderer-exit diagnostics. The portable launcher stores at most 1 MiB in `artifacts/diagnostics/portable-smoke.log` without dumping environment values. With the default graphical platform this session now exits explicitly for missing X display instead of hanging at entry evaluation.

The manual workflow keeps a failed desktop step red, uploads diagnostic logs, and retains the unsigned preview if packaging and bundled-host tests passed. An available preview artifact does not establish desktop acceptance; it allows independent inspection and interactive testing.

The package builder copies an explicit application allowlist, built renderer and complete Electron/.NET runtimes. It does not ship the checkout, source projects, developer dependencies or user settings. Packaged launch selects `process.resourcesPath/host/Sun.Workspace.Host[.exe]`, never an SDK or PATH fallback. Approved raster window artwork is included. An incomplete package reports a repair message.

The transparent icon source and branding approval are unchanged. Native executable metadata/icon still identifies Electron; signing and resource editing are separate release work.

The development smoke and packaged smoke use the same assertions: Monaco mounts, renderer Node is unavailable, sandbox/context isolation/web security stay enabled, the bridge exposes only host information, and the real host responds. The app has a 20-second startup/host/shutdown deadline; the portable launcher has a 30-second outer watchdog. Packaged smoke clears PATH, invalidates DOTNET_ROOT and supplies an invalid developer runtime override. No security switch is disabled.

Windows/Linux layout tests use synthetic runtime fixtures. The native Windows build/host evidence above comes from the manual workflow, and Linux headless desktop evidence comes from real Electron launches. Neither substitutes for the pending interactive Windows gate.

## Governance observation — 2026-11-14

Read-only inspection of active ruleset `27170810` (SUN Main Protection):

- Main requires PRs, resolved conversations and up-to-date required checks; deletion/non-fast-forward protections are active; no bypass actors.
- Required contexts are exactly `repository-validation` and `conventional-title`. Backend/frontend are not separately required. This change makes the already-required repository-validation depend on both application jobs and explicitly fail unless both succeed on a PR; skipped/failed/cancelled application jobs cannot silently pass that gate. Main still skips the full builds. Direct named backend/frontend requirements remain a governed settings follow-up.
- Approving reviews = 0; Code Owner review = false; last-push approval = false. The commented CODEOWNERS starter is replaced with the verified repository owner. CODEOWNERS alone does not require approval, and an author cannot approve their own PR. Independent reviewer selection and sensitive-change enforcement remain open.
- Repository settings permit squash only: merge commits and rebase merges are disabled. The ruleset's broader merge-method list does not enable methods disabled by repository settings.

The GitHub connection has read capability for rules but no repository-administration mutation tool. No ruleset was changed or weakened. The aggregate CI gate is a repository workflow change, not a settings mutation. No deliberately failed-CI merge experiment has been performed.

## Gates before closing M0

- [x] Windows portable build and real bundled-host tests pass (manual run 2).
- [ ] Windows packaged desktop smoke passes with the startup fix.
- [ ] Interactive Windows launch shows Monaco and the approved icon, host check succeeds, closing exits the owned host, and a relocated complete folder launches without installed Node/.NET.
- [ ] Aggregate gate behavior is observed in CI, direct named backend/frontend checks and sensitive-change reviews are enforced, and failed-check blocking has governed evidence.

The optional Windows workflow remains manual-only, with a 12-minute timeout and seven-day artifacts. The preview requires a successful package and host tests; failed desktop smoke also produces diagnostics and keeps the workflow failed. No scheduled jobs, publishing or OS matrix are added. Standard PR backend validation includes one Linux self-contained host publish/test; full builds still do not repeat on main.

See [local development](LOCAL-DEVELOPMENT.md). M1 persistence is planned; this update does not close the outstanding M0 gates.
