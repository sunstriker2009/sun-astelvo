# ADR-001: desktop host and owned stdio IPC

Status: selected; automated Windows foundation acceptance passed. M1 extends the same owned process boundary with workspace operations.

Use Electron with React/TypeScript and Monaco, backed by a local .NET 10 process. This matches the web editor model while preserving .NET application boundaries. The cost is an additional process, Electron distribution size and eventual platform-specific packaging work.

The renderer has no Node integration. The sandboxed preload exposes host information, a fixed workspace-method surface, and native discard confirmation. Main validates the sender frame and exact trusted file URL, denies navigation, windows, webviews and permissions, then calls the host over owned stdio pipes. The native picker selects workspace roots; the renderer cannot supply paths or executables. No HTTP listener, arbitrary IPC invocation or script execution is exposed.

Protocol v1 uses a four-byte big-endian UTF-8 body length, JSON version/request ID/method/params, and correlated result/error responses. M1 raises the unreleased preview's frame ceiling from 4096 bytes to 4 MiB to carry bounded JSON-escaped source text; source files remain limited to 256 KiB. Clients and hosts ship together; mixing binaries from different preview revisions is unsupported. The decoder handles arbitrary chunk boundaries, Unicode and multiple frames. Requests have deadlines and an eight-request limit; malformed output or host exit settles pending requests. The host exits on stdin EOF; shutdown closes stdin then terminates the owned host after a grace interval. A cancelled dirty quit keeps the active host/lease usable.

Development can use an installed .NET SDK/runtime; portable packages select the bundled self-contained host directly. Automated Windows package/host/smoke acceptance passed for the foundation. The first M1 store is described in [Workspace format v1](../architecture/WORKSPACE-FORMAT.md). Installer, script runners, formatting and external language servers are not implemented. Interactive/clean-machine measurements and governance evidence remain open.
