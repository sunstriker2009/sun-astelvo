# ADR-002: portable workspace and recoverable storage

Status: selected for the first M1 implementation; indexing, backup/restore and full organizer acceptance remain open.

Plain UTF-8 source revisions are authoritative for script content. A versioned manifest owns stable identities and logical folders. SQLite remains a proposed rebuildable catalog/search index; it is not introduced by the first slice.

Application saves use copy-on-write source revisions followed by same-directory manifest replacement as the commit point. This avoids a two-file mutable-source/manifest journal: interrupted pre-commit writes leave the prior manifest intact and unreferenced source/temp files are preserved. Flushes and local atomic rename assumptions are explicit; power-loss backup/restore acceptance is not claimed.

A persistent exclusive writer lease coordinates ASTELVO instances. Optimistic manifest/source hashes reject stale saves; externally edited source can be reviewed through Reload before a new revision is saved. Normal dirty-buffer navigation and quit are guarded. Existing symlinks/junctions and Windows UNC roots are rejected. Filesystem checks do not sandbox hostile local processes.

See [Workspace format v1](../architecture/WORKSPACE-FORMAT.md) for schema, paths, limits, recovery behavior and tests. Folder moves change only the existing parent identity and use the same candidate-manifest validation/commit path; they preserve source files and dirty editor buffers without a schema migration. Script duplication copies a reviewed committed source revision into a fresh identity/directory, validates before staging and uses the existing manifest commit point. Unreferenced staged copies are preserved on recovery; this adds no schema fields. Folder subtree duplication remaps all copied IDs, preflights every source within an 8 MiB aggregate bound and publishes the complete subtree through one manifest commit; abrupt process-death acceptance checks complete-or-absent visibility. Tags, recipes, collections and index/backup migrations require explicit future schema decisions. Import must validate containment and links and must never execute code.
