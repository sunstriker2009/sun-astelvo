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

`npm run smoke` is an optional desktop acceptance check after both builds. It requires a functioning graphical session and a supported Electron runtime environment. It mounts Monaco and checks real host IPC with renderer Node access disabled. It does not replace Windows installer, packaged-worker or accessibility validation.

CI skips Electron binary download for short frontend checks. Developer `npm ci` downloads it normally. If you previously installed with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, unset that variable and run `node node_modules/electron/install.js` before launching.

The shell uses the Release host DLL under `src/Sun.Workspace.Host/bin/Release/net10.0/`. Self-contained host publishing and desktop packaging remain M0 acceptance work. No secrets, database or Kubernetes setup is needed.
