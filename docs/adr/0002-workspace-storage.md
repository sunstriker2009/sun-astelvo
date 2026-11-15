# ADR-002: portable workspace and recoverable storage

Status: selected for the first M1 implementation; indexing, backup/restore and full organizer acceptance remain open.

Plain UTF-8 source revisions are authoritative for script content. A versioned manifest owns stable identities and logical folders. SQLite remains a proposed rebuildable catalog/search index; it is not introduced by the first slice.

Application saves use copy-on-write source revisions followed by same-directory manifest replacement as the commit point. This avoids a two-file mutable-source/manifest journal: interrupted pre-commit writes leave the prior manifest intact and unreferenced source/temp files are preserved. Flushes and local atomic rename assumptions are explicit; power-loss backup/restore acceptance is not claimed.

A persistent exclusive writer lease coordinates ASTELVO instances. Optimistic manifest/source hashes reject stale saves; externally edited source can be reviewed through Reload before a new revision is saved. Normal dirty-buffer navigation and quit are guarded. Existing symlinks/junctions and Windows UNC roots are rejected. Filesystem checks do not sandbox hostile local processes.

See [Workspace format v1](../architecture/WORKSPACE-FORMAT.md) for schema, paths, limits, recovery behavior and tests. Folder moves change only the existing parent identity and use the same candidate-manifest validation/commit path; they preserve source files and dirty editor buffers without a schema migration. Script duplication copies a reviewed committed source revision into a fresh identity/directory, validates before staging and uses the existing manifest commit point. Unreferenced staged copies are preserved on recovery; this adds no schema fields. Folder subtree duplication remaps all copied IDs, preflights every source within an 8 MiB aggregate bound and publishes the complete subtree through one manifest commit; abrupt process-death acceptance checks complete-or-absent visibility. Tags, recipes, collections and index/backup migrations require explicit future schema decisions. Import must validate containment and links and must never execute code.


Script recycle bin extends this decision with explicit schema v2, retaining complete Script records and source revisions. V1 ordinary operations remain v1; first deletion requires explicit upgrade consent and an exact pre-upgrade manifest backup before the v2 commit. Identity-preserving restore validates hash, destination/name and revision; unknown fields are still rejected. See the workspace format for migration/recovery limits. This does not implement folder deletion, full workspace backup or automatic downgrade.


Folder subtree recycling extends the same commit model with explicit schema v3 and an exact pre-upgrade v1/v2 checkpoint. `deletedFolderTrees` partitions preserve complete folders, active scripts and independently deleted scripts; restoration keeps each script's prior deleted state. Validation enforces connected trees, global identity uniqueness and combined live/trash limits. Historical root parents may be unavailable; restore explicitly selects a live destination. Scripts and folders retain IDs/source bytes, and source verification precedes the single manifest commit. No permanent purge or full workspace backup is introduced. The format document records timeout, recovery and compatibility limits.


Tags/favourites introduce explicitly confirmed schema v4. A required Classification record accompanies every active or deleted Script, including folder-tree trash. Migration retains the exact prior metadata checkpoint, initializes all existing records and applies the requested active-script classification in one manifest commit. Classification writes are metadata-only and use revision/hash conflict checks; copy/save/recycle/restore preserve the record. Unknown or version-incompatible fields fail closed. Basic renderer metadata filters do not establish the proposed SQLite catalog or indexed source search; those and saved collections remain future work.


Saved metadata collections extend the manifest with explicit schema v5 and exact pre-upgrade checkpoints. Collections store stable IDs plus the existing folder/name/language/single-tag/favourite predicates, not copied scripts. Direct old-schema upgrades reuse classification migration across all recycle partitions. Folder references include retained deleted folders; a recycled scope is dormant rather than silently widened, and restore reactivates it. Collection writes are revision-checked manifest-only commits. Indexed source search, multi-tag/recency predicates and future purge/reference reconciliation are not established by this batch.


[ADR-004](0004-source-search-index.md) selects a bounded host-memory inverted source-word index for the initial search implementation, with explicit rebuild, manifest binding and per-query source hash verification. It introduces no portable schema or cache files. The proposed persistent SQLite catalog, search-performance acceptance and collection predicate extensions remain open.
