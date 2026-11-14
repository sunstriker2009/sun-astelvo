# M0 foundation validation

Updated 2026-11-14. This records foundation checks and a portable spike, not completed M0 or a release.

| Check | Evidence |
| --- | --- |
| .NET host Release build | SDK 10.0.404; zero warnings/errors |
| TypeScript and renderer/Monaco bundle | Passed locally |
| Node protocol/client/package tests | 10 passed: prior protocol/package cases plus fresh Electron runtime preparation, installer-failure propagation and missing-executable rejection |
| Real host integration | 2 passed against development DLL and 2 against the bundled Linux executable: correlation/EOF shutdown and oversized-frame rejection |
| Runtime-independent host | Bundled-host tests clear the child PATH and set invalid DOTNET_ROOT; no installed runtime command is available |
| Production dependency audit | Zero vulnerabilities after patched DOMPurify 3.4.17 override; no dependencies added in this packaging change |
| Linux x64 portable directory | Built; self-contained .NET runtime 10.0.15 and Electron included; runtime notices retained |
| Full desktop smoke | Development and packaged attempts timed out here: no graphical display, system bus/socket access unavailable. Not a passing desktop result |
| Windows portable | First on-demand run failed during staging: fresh npm install had no Electron dist. Windows .NET publish, typecheck and prior nine tests passed; host/desktop acceptance was skipped. Runtime preparation fix added; Windows rerun pending |
| Installer, signing and native executable resource branding | Outside this spike; remain M5 work |
| Branch enforcement | Live rules inspected; this PR makes required repository-validation aggregate backend/frontend results; exact named check/review configuration and failed-check acceptance remain open |

## Packaging and smoke

### Fresh-install failure and fix

[Windows acceptance run 1](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43584284121) failed with ENOENT while copying `node_modules/electron/dist`. Electron 45's npm package installs its binary lazily through its CLI; packaging copied the directory directly and never triggered the download. This was a packaging bootstrap defect, not a failed .NET publish or desktop-smoke result.

The builder now invokes `node node_modules/electron/install.js` from the pinned installed package before publishing/staging, checks that the native executable exists, and propagates installer failures immediately. Existing matching installs reuse Electron's own installed/cache checks. Unit regression uses a fresh package fixture without dist and exercises installer failure and missing-output cases. A separate clean Linux dependency install without lifecycle scripts confirms that packaging prepares the real pinned runtime and completes; this does not establish Windows desktop acceptance.

After merging the fix, start a **new** manual workflow run on main. Re-running the original failed run would reuse its old commit and the old packaging code.

The package builder copies an explicit application allowlist, built renderer and complete Electron/.NET runtimes. It does not ship the checkout, source projects, developer dependencies or user settings. Packaged launch selects `process.resourcesPath/host/Sun.Workspace.Host[.exe]`, never an SDK or PATH fallback. Approved raster window artwork is included. An incomplete package reports a repair message.

The transparent icon source and branding approval are unchanged. Native executable metadata/icon still identifies Electron; signing and resource editing are separate release work.

The development smoke and packaged smoke use the same assertions: Monaco mounts, renderer Node is unavailable, sandbox/context isolation/web security stay enabled, the bridge exposes only host information, and the real host responds. The app has a 20-second startup/host/shutdown deadline; the portable launcher has a 30-second outer watchdog. Packaged smoke clears PATH, invalidates DOTNET_ROOT and supplies an invalid developer runtime override. No security switch is disabled.

Windows/Linux layout tests use synthetic runtime fixtures; they are not native Windows launch evidence. Linux host-only tests prove self-contained host operation, not the full desktop gate.

## Governance observation — 2026-11-14

Read-only inspection of active ruleset `27170810` (SUN Main Protection):

- Main requires PRs, resolved conversations and up-to-date required checks; deletion/non-fast-forward protections are active; no bypass actors.
- Required contexts are exactly `repository-validation` and `conventional-title`. Backend/frontend are not separately required. This change makes the already-required repository-validation depend on both application jobs and explicitly fail unless both succeed on a PR; skipped/failed/cancelled application jobs cannot silently pass that gate. Main still skips the full builds. Direct named backend/frontend requirements remain a governed settings follow-up.
- Approving reviews = 0; Code Owner review = false; last-push approval = false. The commented CODEOWNERS starter is replaced with the verified repository owner. CODEOWNERS alone does not require approval, and an author cannot approve their own PR. Independent reviewer selection and sensitive-change enforcement remain open.
- Repository settings permit squash only: merge commits and rebase merges are disabled. The ruleset's broader merge-method list does not enable methods disabled by repository settings.

The GitHub connection has read capability for rules but no repository-administration mutation tool. No ruleset was changed or weakened. The aggregate CI gate is a repository workflow change, not a settings mutation. No deliberately failed-CI merge experiment has been performed.

## Gates before closing M0

- [ ] Windows portable build, packaged-host tests and packaged smoke pass.
- [ ] Interactive Windows launch shows Monaco and the approved icon, host check succeeds, closing exits the owned host, and a relocated complete folder launches without installed Node/.NET.
- [ ] Aggregate gate behavior is observed in CI, direct named backend/frontend checks and sensitive-change reviews are enforced, and failed-check blocking has governed evidence.

The optional Windows workflow is manual-only, with a 12-minute timeout and seven-day artifact on success. No scheduled jobs, publishing or OS matrix are added. Standard PR backend validation adds one Linux self-contained host publish/test; full builds still do not repeat on main.

See [local development](LOCAL-DEVELOPMENT.md). M1 persistence is planned; this update does not close the outstanding M0 gates.
