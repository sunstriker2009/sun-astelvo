# Local development — organizer preview

Prerequisites: Node.js 24 and .NET 10 SDK on your development machine. Windows is the first release target; Linux checks validate code/protocol behaviour only.

```sh
npm ci
npm run build:host
npm run typecheck
npm test
npm run test:host
npm run build
npm start
```

Create a workspace in an empty local folder or open an existing workspace through the native picker. Add logical folders and JavaScript/Python/C# scripts. Select a script, edit in Monaco, and save with the button or Ctrl/Cmd+S. Script name, language and folder controls are saved together. Reload explicitly reviews external changes; stale saves fail while preserving the buffer. Dirty navigation/quit asks before discarding. Closing the workspace releases its writer lease. Formatting and runners are not implemented. Build both sides and restart after source changes.

`npm run smoke` is an optional desktop acceptance check after both builds. It requires a functioning graphical session and a supported Electron runtime environment. It mounts Monaco and checks real host IPC with renderer Node access disabled, sandbox/context isolation enabled, and a 20-second deadline. It does not replace Windows installer, packaged-worker or accessibility validation.

Electron 45 downloads its runtime lazily when its CLI is first launched. `npm ci` alone does not guarantee `node_modules/electron/dist` exists. Frontend CI does not need that runtime for its short build/tests. To prepare the pinned runtime explicitly, run `node node_modules/electron/install.js`.

Development uses the Release DLL under `src/Sun.Workspace.Host/bin/Release/net10.0/`. Set `ASTELVO_DOTNET` if the development SDK executable is not on PATH. Packaged launch ignores this override and selects its bundled host directly. No secrets, database or Kubernetes setup is needed.

## Portable preview

On Windows or Linux x64/arm64, build for the current OS/architecture:

```sh
npm ci
npm run package:portable
npm run smoke:portable
```

The build machine needs Node.js 24, the .NET 10 SDK, and dependency restore access. Before publishing, the package command explicitly runs the pinned local Electron installer and checks the native executable. It then publishes a self-contained .NET host, rebuilds the renderer, and stages an explicit app allowlist with that Electron distribution. It preserves Electron and runtime-pack license notices. No additional packaging dependency is installed, and no broad npm lifecycle-script approval is enabled.

The output is `artifacts/portable/ASTELVO-win-x64/` or the matching platform/RID. Extract/copy the **whole folder**, then start `ASTELVO.exe` on Windows or `./astelvo` on Linux. Both runtimes are included. Packaged host startup never falls back to a globally installed runtime. macOS and Linux musl are outside this spike.

The application window uses the approved raster icon; the native executable retains Electron's default resource icon/metadata. This is an unsigned portable preview. Signing, installer/uninstaller, native resource branding and updates remain M5 work.

`smoke:portable` launches the native package with an empty PATH, invalid DOTNET_ROOT and invalid developer runtime override. It checks Monaco, renderer isolation and real bundled-host IPC. The app deadline is 20 seconds; the outer launcher deadline is 30 seconds. Run it in a functioning graphical session. Do not disable the sandbox or web security to pass. For host-only checks, set `ASTELVO_HOST_EXECUTABLE` to the absolute bundled host executable and run `npm run test:host`; those tests clear the child PATH automatically.

The **Windows portable acceptance** workflow is manual-only. Once merged, open Actions, choose that workflow and start a new run on the desired branch. It builds and tests a Windows bundle, runs packaged desktop smoke, and uploads a seven-day unsigned preview if package and host tests passed. A desktop failure keeps the run red and also uploads diagnostics; preview availability does not establish desktop acceptance. Retrying an old run uses its old commit, so start a new run after merging a fix. No schedule, push trigger, matrix or release publication is configured. Use the preview for separate interactive and clean-machine checks; a hosted runner result alone is not installer acceptance.

Smoke output names its startup stage and records preload/load/renderer failures. The portable launcher saves bounded output to `artifacts/diagnostics/portable-smoke.log` (at most 1 MiB), including exit/watchdog status, without dumping environment values. Startup schedules window creation after readiness and lets the main ESM entry finish immediately; do not add a top-level wait on app readiness.

For a Linux environment without an X display, a separate headless development check is available:

```sh
node node_modules/electron/cli.js desktop/smoke.mjs --ozone-platform=headless --disable-gpu
```

Run it after building both sides. This selects a headless display backend and software rendering; the smoke still asserts renderer sandboxing, context isolation and web security. It does not replace Windows or interactive visual validation.

Automated Windows foundation acceptance passed in [run 43609933010](https://github.com/sunstriker2009/sun-astelvo/actions/runs/43609933010). The first organizer slice still needs its own Windows acceptance run; interactive/clean-machine and governance follow-ups remain open. See [workspace format/limits](../architecture/WORKSPACE-FORMAT.md). Save is manual; a crash can lose unsaved edits.

## Workspace editor acceptance

After building the development host and renderer, run `npm run smoke:workspace`. On Linux without a display, append `-- --ozone-platform=headless --disable-gpu`. It uses the real UI, bridge and host with a temporary workspace, covering folder/script creation, typing/save/reopen, rename, and cancellation of a dirty app quit. Native dialog overrides exist only in this development test entry, which is excluded from portable assets. The wrapper requires an explicit success marker. The manual Windows workflow also runs this editor acceptance; automatic PR CI retains bounded host/unit checks without an added OS matrix.
