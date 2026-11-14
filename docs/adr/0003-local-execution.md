# ADR-003: trusted local execution boundary

Status: proposed; runners begin in M3/M4.

Run user scripts in separately owned runtime processes, never in the renderer, preload, Electron main or workspace host. Take an immutable buffer/recipe snapshot for each run. Use structured arguments, bounded stdout/stderr, explicit stdin, deadlines and whole-process-tree cleanup.

Local script execution uses the user's OS permissions. UI sandboxing and process separation do not provide a security sandbox for scripts. Imports, opening documents, formatting and app startup must never implicitly execute scripts or install dependencies.

The M0 host exposes only product/runtime information. The UI Run button is disabled. It has no script execution endpoint, arbitrary path input or general process launcher. Runner trust prompts, runtime discovery, dependency handling and Windows Job Object behaviour require separate implementation and acceptance tests.
