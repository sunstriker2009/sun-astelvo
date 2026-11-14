# Local development — M0 foundation

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

The app opens a temporary Monaco buffer with JavaScript/Python/C# highlighting and a language selector. **Check host connection** validates the real .NET process boundary. Saving, organization, formatting and running scripts are not implemented yet. Close the window to stop the owned host. Build both sides again and restart after source changes; hot reload is outside this spike.

`npm run smoke` is an optional desktop acceptance check after both builds. It requires a functioning graphical session and a supported Electron runtime environment. It mounts Monaco and checks real host IPC with renderer Node access disabled, sandbox/context isolation enabled, and a 20-second deadline. It does not replace Windows installer, packaged-worker or accessibility validation.

CI skips Electron binary download for short frontend checks. Developer `npm ci` downloads it normally. If you previously installed with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, unset that variable and run `node node_modules/electron/install.js` before launching.

Development uses the Release DLL under `src/Sun.Workspace.Host/bin/Release/net10.0/`. Set `ASTELVO_DOTNET` if the development SDK executable is not on PATH. Packaged launch ignores this override and selects its bundled host directly. No secrets, database or Kubernetes setup is needed.

## Portable preview

On Windows or Linux x64/arm64, build for the current OS/architecture:

```sh
npm ci
npm run package:portable
npm run smoke:portable
```

The build machine needs Node.js 24, the .NET 10 SDK, and dependency restore access. The command publishes a self-contained .NET host, rebuilds the renderer, and stages an explicit app allowlist with the installed Electron distribution. It preserves Electron and runtime-pack license notices. No additional packaging dependency is installed.

The output is `artifacts/portable/ASTELVO-win-x64/` or the matching platform/RID. Extract/copy the **whole folder**, then start `ASTELVO.exe` on Windows or `./astelvo` on Linux. Both runtimes are included. Packaged host startup never falls back to a globally installed runtime. macOS and Linux musl are outside this spike.

The application window uses the approved raster icon; the native executable retains Electron's default resource icon/metadata. This is an unsigned portable preview. Signing, installer/uninstaller, native resource branding and updates remain M5 work.

`smoke:portable` launches the native package with an empty PATH, invalid DOTNET_ROOT and invalid developer runtime override. It checks Monaco, renderer isolation and real bundled-host IPC. The app deadline is 20 seconds; the outer launcher deadline is 30 seconds. Run it in a functioning graphical session. Do not disable the sandbox or web security to pass. For host-only checks, set `ASTELVO_HOST_EXECUTABLE` to the absolute bundled host executable and run `npm run test:host`; those tests clear the child PATH automatically.

The **Windows portable acceptance** workflow is manual-only. Once merged, open Actions, choose that workflow and Run workflow on the desired branch. It builds and tests a Windows bundle, runs packaged desktop smoke and uploads a seven-day artifact only on success. No schedule, push trigger, matrix or release publication is configured. Use the downloaded artifact for separate interactive and clean-machine checks; a hosted runner result alone is not installer acceptance.

Desktop launch, Windows acceptance and governance enforcement remain open in [M0 validation](M0-VALIDATION.md). M1 will add storage and organization; this preview still loses its editor buffer on close.
