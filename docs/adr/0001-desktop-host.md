# ADR-001: desktop host and owned stdio IPC

Status: selected for M0 spike; Windows packaged acceptance pending.

Use Electron with React/TypeScript and Monaco, backed by a local .NET 10 process. This matches the web editor model while preserving .NET application boundaries. The cost is an additional process, Electron distribution size and eventual platform-specific packaging work.

The renderer has no Node integration. A sandboxed preload exposes only `hostInfo()`. Main validates the sender frame and exact trusted file URL, denies navigation, windows, webviews and permissions, then calls the host over owned stdio pipes. No HTTP listener or renderer-supplied executable/command is exposed.

Protocol v1 uses a four-byte big-endian UTF-8 body length, maximum 4096 bytes, JSON version/request ID/method, and correlated responses. M0 permits only `host.info`. The decoder handles arbitrary chunk boundaries, Unicode and multiple frames. Requests have deadlines and an eight-request limit; malformed output or host exit settles pending requests. The host exits on stdin EOF; app shutdown closes stdin then terminates the owned host after a grace interval.

This is a development launch path using the installed .NET SDK/runtime. It does not yet bundle a self-contained worker, installer, script runner, storage or external language server. Those limits must remain visible in status reporting. Windows shell/package measurements remain required before completing M0.
