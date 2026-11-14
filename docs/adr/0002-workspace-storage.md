# ADR-002: portable workspace and recoverable storage

Status: selected for the first M1 implementation; indexing, backup/restore and full organizer acceptance remain open.

Plain UTF-8 source revisions are authoritative for script content. A versioned manifest owns stable identities and logical folders. SQLite remains a proposed rebuildable catalog/search index; it is not introduced by the first slice.

Application saves use copy-on-write source revisions followed by same-directory manifest replacement as the commit point. This avoids a two-file mutable-source/manifest journal: interrupted pre-commit writes leave the prior manifest intact and unreferenced source/temp files are preserved. Flushes and local atomic rename assumptions are explicit; power-loss backup/restore acceptance is not claimed.

A persistent exclusive writer lease coordinates ASTELVO instances. Optimistic manifest/source hashes reject stale saves; externally edited source can be reviewed through Reload before a new revision is saved. Normal dirty-buffer navigation and quit are guarded. Existing symlinks/junctions and Windows UNC roots are rejected. Filesystem checks do not sandbox hostile local processes.

See [Workspace format v1](../architecture/WORKSPACE-FORMAT.md) for schema, paths, limits, recovery behavior and tests. Tags, recipes, collections and index/backup migrations require explicit future schema decisions. Import must validate containment and links and must never execute code.
