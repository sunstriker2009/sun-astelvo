# ADR-002: portable workspace and recoverable storage

Status: proposed; implementation starts in M1.

Plain source files are authoritative for script content. A versioned manifest owns stable IDs, folders, tags, recipes and smart collections. SQLite is a rebuildable catalog/search index with local history, not a competing authority for portable metadata.

Use a writer lease, journalled source/manifest operations, hashes and atomic file replacement where supported. On restart reconcile incomplete changes, then rebuild indexes. External edits must not overwrite dirty buffers. Imports must validate path boundaries and symlinks and must never execute code. Backup acceptance requires restore into a fresh workspace.

No storage is implemented by the M0 shell: its buffer is deliberately temporary. Adding persistence requires conflict/recovery tests and a reviewed manifest schema.
