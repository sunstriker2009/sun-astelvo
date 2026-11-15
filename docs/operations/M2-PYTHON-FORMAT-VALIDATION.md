# M2 Python/Ruff formatter — local evidence, 2026-11-15

Implemented on `feature/m2-python-formatting`, based on merged JavaScript formatter PR #35 (`a16657de`). Live GitHub showed no overlapping implementation PR. [ADR-011](../adr/0011-python-formatting.md) records the pinned WASM adapter, shared worker lifecycle and approximate cursor mapping. [Owner authorization](DEVELOPMENT-AUTHORIZATION.md) permits CI-gated squash auto-merge with final human review deferred.

## Checks run

- .NET SDK 10.0.404 Release host build: zero warnings/errors. TypeScript and renderer/JavaScript/Python-worker builds passed.
- All 38 frontend/protocol/startup/portable-layout/coordinator/formatter tests passed. Six new Python tests exercise uninitialized/corrupt-WASM failure and valid initialization, exact Ruff version, deterministic/idempotent output, non-execution of file-writing Python data, BOM/shebang/Unicode/comments/CRLF, syntax/cursor/Unicode/input/output bounds, validation before initialization, bounded diagnostics, cursor approximation and language routing/cancellation/deadline/termination. Existing JavaScript tests remain active through the shared request handler.
- Real headless Electron workspace acceptance passed: bundled Ruff runs with the unchanged CSP and sandbox, without invoking Python; formatting a raising source succeeds as data, source/metadata/label drafts stay independent, Undo/Redo and no-op formatting survive explicit Save, Alt+Shift+F selects Python, syntax failures preserve buffer/files, and removal/restoration of the real built worker retains the buffer and permits retry. C# formatting and Run remain visibly unavailable. Prior organizer/import/archive/tab/recovery/JavaScript tests remain active.
- The test keyboard helper now waits for foreground editing to be enabled before Ctrl+A/Undo/Redo, preventing synthetic insertion from racing the read-only formatting lock. Assertions still compare recovered/formatted text and unchanged canonical metadata.
- Headless foundation smoke passed: Monaco, exact bridge surface, renderer isolation and real host IPC.
- Portable Windows/Linux layout fixtures retain the Python worker plus Ruff licence/source notices. Actual generated LICENSE/README copies match the pinned package byte-for-byte. The self-contained Python worker measured 13,464,790 bytes for this build; no WASM binary is fetched at runtime or committed as a separate repository binary.
- `npm audit --omit=dev` reported zero known npm vulnerabilities at the check. The upstream MIT package licence was inspected/retained; this does not audit compiled Rust dependencies.
- `git diff --check` passed.

The host implementation/protocol and portable workspace format are unchanged; its full 63-test suite was not rerun locally for this renderer adapter batch. Desktop tests exercised real host persistence and CI retains its existing host suites.

## Gates still open

Check the PR for required CI/merge state. C#/Roslyn, all script runners, persistent catalog, collection extensions/examples and other M1–M5 work remain unfinished. Python cursor mapping is approximate inside changed regions; real stalled-WASM interruption/timeout, forced result/model races, cold compilation/memory, full cursor/scroll/multicursor/accessibility and complete compiled Rust dependency/licence inventory remain acceptance work. No new Windows/packaged/clean-machine, installer, OS shutdown/power-loss or final human product review was run. The M0 Windows baseline (run 43609933010 at `517277cbee5bd958748d5e5a25bb77c1a2c81cb1`) remains distinct. Formatting availability does not claim execution capability, and renderer isolation does not sandbox future scripts.
