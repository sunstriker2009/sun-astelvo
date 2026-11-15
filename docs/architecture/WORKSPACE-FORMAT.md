# Workspace formats v1–v5

Status: implemented for the first M1 slice; full organizer acceptance remains open.

## Authority and layout

A workspace is an existing local directory selected through the native folder picker. Creation requires an empty directory. The renderer cannot supply filesystem paths, executable names or arbitrary IPC methods.

| Path | Role |
| --- | --- |
| `workspace.json` | Authoritative versioned metadata: workspace identity, revision, folders and scripts |
| `scripts/<script-id>/<source-hash>.<extension>` | Plain UTF-8 script revision; extensions js, py and cs |
| `.astelvo-writer.lock` | Persistent lock file held open exclusively by the owning host |
| `*.tmp` / unreferenced content revisions | Interrupted-operation leftovers; ignored and preserved |

Folders are logical metadata with stable GUID identities, not user-named filesystem paths. Rename/move operations update metadata without changing a script's identity. The editor's root view shows all scripts; selecting a folder filters its direct children.

Manifest fields are `format="astelvo-workspace"`, `schemaVersion=1`, nonempty GUID `id`, `name`, nonnegative `revision`, `folders` and `scripts`. Folder records contain `id`, `name`, nullable `parentId`. Script records contain `id`, `name`, `language`, nullable `folderId`, and lower-case SHA-256 `sourceHash`. Required fields, unknown fields, unsupported versions, duplicate identities/names, dangling folders and cycles are rejected. There is no silent migration or repair. Version 2 adds the required `deletedScripts` array, using the same complete Script record shape; v1 rejects that field even when null. Unknown fields in either version remain errors.

Names contain 1–120 UTF-16 code units, without controls, slashes, surrounding whitespace, or the special labels dot/dot-dot. Names must be unique ignoring case among scripts in the same folder or folders under the same parent. Folder and script names use separate namespaces.

## Folder moves

`folder.move` takes only the folder ID and nullable destination parent ID. It updates that folder's `parentId` in the existing v1 manifest. Descendant folder/script IDs, source references and source bytes are unchanged; no schema change or metadata migration is needed. Cycles (including moving into a descendant), missing destinations and case-insensitive sibling-name collisions fail before the commit. Invalid requests do not rewrite metadata. Moving to the current parent checks for external metadata conflicts but performs no write or revision increment.

The selected-folder destination list excludes itself and its descendants; the host independently validates the complete candidate hierarchy. A move preserves the current editor text, dirty state and undo model. Existing source hash checks still apply when the user subsequently saves. The next snapshot is installed only after a successful manifest commit; failures keep the current view and buffer.

## Save and restart

1. Compare the loaded manifest bytes with the current manifest hash; compare a saved script's actual source hash with the editor's expected hash.
2. Write a new source revision to a uniquely named temporary file in the destination directory, flush it to storage, then rename it into place. An existing revision is verified and never overwritten by the application.
3. Validate the candidate manifest, increment its revision, write/flush a temporary manifest, then replace `workspace.json` by same-directory rename.
4. Publish the updated in-memory snapshot only after manifest replacement.

The manifest replacement is the commit point. Interruption before it leaves the previous manifest/revision reachable; a source revision written before interruption becomes an ignored orphan. The app retains old content versions and does not automatically remove leftovers. A returned I/O error or lost/timed-out response can have an uncertain commit outcome: refresh/reopen and inspect before retrying. There are no automatic write retries.

This is copy-on-write recovery, not a journal spanning mutable source and metadata files. It assumes supported local filesystem rename semantics. File flushes do not establish a complete power-loss guarantee or cross-device/network atomicity. Backup/restore, fault-injected power-loss acceptance, retention and garbage collection remain future M1/M5 work.

## Script duplication

`script.duplicate` accepts the original ID, explicit new name/destination folder ID and expected source hash. It copies only the committed revision: the expected hash must match both the manifest reference and the actual file bytes. External edits require Reload followed by Save before duplication. The UI disables duplication while the current buffer or metadata is dirty or a loaded external revision has not been adopted.

The copy gets a new GUID and its own source revision directory. Language and source bytes are copied exactly; later edits to either script are independent. The original metadata/source is never overwritten. The existing strict schema stays at v1: this operation adds no metadata fields and requires no migration. Unknown fields still fail closed rather than being silently dropped.

Validate size, UTF-8, destination, sibling-name uniqueness and script-count limits before staging. Recheck the original bytes after staging and manifest freshness at commit. The same manifest replacement commit point and uncertain-outcome rules as Save apply: a late conflict/interruption may retain an unreferenced copy directory, which is ignored and preserved after reopening. There is no automatic cleanup/retry. Preflight rejection leaves the manifest and managed script directories unchanged. The UI preserves the current document and error context on failure; successful duplication opens the copy.

## Folder subtree duplication

`folder.duplicate` accepts an existing folder ID, explicit copy name, nullable destination parent and the loaded workspace revision. Stale revisions and external manifest changes are rejected. The host snapshots the finite subtree and assigns fresh IDs to every copied folder/script, remapping all internal folder references. Empty nested folders are retained. A destination inside the original subtree is rejected; the UI excludes those destinations. Existing names, languages and source hashes are retained except the explicit new root name. Schema remains v1 with no migration or metadata loss.

Preflight the entire candidate manifest (including the next revision), 200-folder/1,000-script caps, 1 MiB manifest cap, UTF-8 and all committed source hashes before staging anything. Aggregate source content is limited to 8 MiB per folder-copy operation; individual files retain the 256 KiB limit. Sources are cached within this bound, staged under new IDs, then rechecked before one manifest replacement exposes the complete copy. A late failure or termination may leave unreferenced revisions/directories, which are ignored and preserved. A recovered manifest exposes either the whole copied subtree or none; this is not a full power-loss guarantee.

Folder duplication has a bounded 30-second desktop request deadline to accommodate multiple flushed source files; other requests keep five seconds. A timed-out/lost response may have committed: reopen and inspect before manually retrying. There are no automatic retries. The UI requires saved open edits and adopted external changes, retains the current editor, and selects the copied root after success. Normal script execution remains unavailable.

## External changes and locking

An external source edit is loaded explicitly through Reload/read, returned with its actual hash, and marked as external. A stale editor save fails without replacing that external source. Once reviewed, saving creates a new revision and updates the manifest reference. Manual edits can modify historical revision bytes, so immutability describes application writes, not protection from other local programs.

External manifest changes require reopening the same workspace to refresh metadata. Failed workspace selection/open does not discard the current buffer or release the active workspace. A normal switch/close releases its lease; abrupt host death releases the OS handle. The lock file itself is intentionally retained to avoid inode replacement races. The lease coordinates ASTELVO writers; external tools need not honor it.

Existing symlinks/junctions on managed paths are rejected. Windows UNC roots are rejected. Network/cloud-synchronized workspaces are unsupported. Path checks are not a security boundary against a hostile process racing filesystem changes with the same OS permissions.

## Limits and bridge

- 256 KiB UTF-8 per script; 1 MiB serialized manifest.
- 200 folders and 1,000 scripts including all recycle-bin records in this preview.
- Bounded 4 MiB length-prefixed JSON frames, eight pending client requests, five-second default request deadline. Larger frames accommodate JSON-escaped source text; they do not increase the script size limit.
- Host methods: information, workspace open/close, folder create/rename/move/duplicate/delete/restore, script create/read/save/duplicate/delete/restore/classify. Script save also renames, changes language and moves between folders.
- Native folder selection supplies the open/create path. The renderer bridge exposes explicit methods with validated inputs and correlated, validated results.

SQLite/search indexing, import/export, autosave and formatting/runners are not implemented by this slice. Save is explicit (button or Ctrl/Cmd+S). Switching/reloading dirty scripts asks before discarding. Normal window/app quit asks before losing dirty edits; cancelling quit keeps the host/lease usable. OS termination or a crash can still lose an unsaved editor buffer.

## Evidence

Real-host tests cover UTF-8 persistence, language/rename/move identity, folder rename, second-writer rejection, lease release after close and abrupt death, maximum-size JSON-escaped source, external source/manifest conflicts, unsupported schema, orphan/temp files, symlink/junction rejection and request bounds.

A real Electron editor acceptance entry creates an isolated temporary workspace through the normal renderer/native-picker bridge, creates a folder/script, types/saves, cancels a dirty quit, reloads, closes/reopens and renames the script. It is excluded from production bundles; dialog overrides exist only in that test entry. A wrapper requires an explicit success marker so an early exit-zero quit cannot pass acceptance.


## Script recycle bin and explicit v2 upgrade

Opening or ordinarily editing v1 keeps the serialized manifest at v1. The first `script.delete` requires `allowUpgrade=true`, after the desktop confirmation explains that older builds cannot open v2. Before replacing the manifest, the host retains its exact v1 bytes in `workspace.v1.<manifest-sha256>.json`. It never overwrites a mismatched existing backup. The backup is a pre-upgrade metadata checkpoint, not a current full-workspace backup or an automatic downgrade; manually restoring it would discard later organization changes. All source revisions are retained.

Delete takes ID, expected source hash and expected workspace revision. It verifies committed UTF-8 source bytes and metadata freshness, then moves the complete Script record from `scripts` to `deletedScripts` in one manifest replacement. No source path is moved or erased, IDs and folder/language/hash metadata survive, and active read/save/duplicate cannot address deleted scripts. The UI disables delete for unsaved or unadopted external edits. Cancelling confirmation leaves the editor and workspace unchanged.

Restore takes the deleted identity, explicit destination/name and expected workspace revision. It verifies source presence, hash, UTF-8 and path containment, validates active sibling-name uniqueness, then moves the same identity back in one manifest replacement. An explicit name/destination resolves collisions without overwriting another script. Deleted names may repeat; IDs remain globally unique across folders, active scripts and deleted scripts. The combined active/deleted count remains limited to 1,000. All other mutations preserve the deleted records, and v2 remains v2 even after the bin empties. Permanent purge is not implemented. Folder subtree recycling uses the explicit v3 extension below.

Preflight rejection does not alter source files or the manifest. Upgrade can leave an unused v1 backup after a later failure; restart still uses only `workspace.json` and ignores partial temp files. A lost response can still have committed: reopen/inspect before retrying. Existing atomic-rename and power-loss limitations apply. Changed/missing deleted source blocks restore without replacing external bytes; manual source recovery may be needed. The recycle bin is not a backup of externally mutable source files.


## Folder subtree recycle bin and explicit v3 upgrade

`folder.delete` takes an active folder ID, expected workspace revision and `allowUpgrade`. First folder deletion from v1 or v2 requires explicit confirmation of format v3 and retains the exact previous manifest at `workspace.v<previous-schema>.<manifest-sha256>.json`. Existing v1/v2 workspaces keep their schema until an operation explicitly needs an upgrade. Ordinary script deletion/restoration on v3 preserves v3 and all folder trash; there is no automatic downgrade.

V3 requires `deletedScripts` and `deletedFolderTrees` arrays. A deleted tree has `rootId`, `folders`, `scripts` and `deletedScripts`. It stores the complete folder records and complete Script records with original IDs. `scripts` are the subtree's previously active scripts; `deletedScripts` are scripts already in the script bin whose original folder lies in the subtree. Deleting the tree removes these records from their live arrays and publishes the entire tree through one manifest replacement. Source files remain in place. Independent deleted trees are not merged when their historical parent is later deleted.

`folder.restore` takes the deleted root ID, explicit new root name, nullable live destination parent and expected revision. It restores the original folder hierarchy and active script identities, returns independently deleted scripts to the script bin, and removes the group through one manifest replacement. Root renaming/reparenting resolves collisions and a missing original parent. Descendant relationships and all script IDs/source references survive. A restored tree cannot target its own deleted IDs or an unavailable parent. Deleted roots may retain historical parent IDs that are no longer live; only an explicit live destination is used at restore time.

Validation requires each deleted tree to be connected, its root to exist, all script folder references to stay inside it, and global identity uniqueness across live records and every recycle-bin partition. Unknown fields, missing required arrays and folder-trash fields on v1/v2 fail closed. Combined limits remain 200 folders and 1,000 scripts, including complete deleted trees and all independently deleted scripts; moving records to the bin does not free these limits. Name uniqueness applies to active sibling folders/scripts within each partition. Deleted script names may repeat.

Delete and restore preflight the full candidate manifest before source verification or backup. Every affected source must be present, valid UTF-8, inside the managed path and match its committed hash, including already-deleted scripts in the tree. Source verification reads one bounded file at a time without retaining the whole tree. Delete rechecks sources after backup and manifest freshness at commit. A missing/changed deleted source blocks whole-tree restore without overwriting it. Folder delete/restore use a 30-second desktop deadline; timed-out/lost responses can have committed, so reopen and inspect before retrying. There are no automatic retries.

The UI disables folder delete while any open buffer is dirty or has unadopted external edits. Native confirmation defaults to Cancel and explains the upgrade and retained source files. Cancellation/failure preserves the editor. Successful deletion clears the current document only when it belonged to the deleted subtree; an unrelated editor is retained. Restore leaves the current editor unchanged. Deleted folders have a separate selector showing root name, subtree counts and identity. Permanent purge, retention cleanup and full workspace backup/restore remain unfinished.

Local host tests include abrupt process termination observed during upgrade backup activity, validating complete active-or-deleted visibility and intact source bytes after reopening. A separate test constructs checkpoint/temp leftovers to validate a pre-commit restart. Neither establishes power-loss durability or Windows acceptance.


## Tags, favourites and explicit v4 upgrade

The first `script.classify` explicitly confirms workspace format v4 and writes an exact pre-upgrade v1/v2/v3 metadata checkpoint using the existing hash-named backup mechanism. Opening and ordinary operations on old workspaces keep the old schema. Migration populates every active/deleted script and every script in a deleted folder tree with a `classification` object: `tags=[]`, `favourite=false`, except the explicitly edited script. All identities, source references, folder hierarchies and prior deleted states are retained. V4 requires classification on every script in every partition; classification fields on older schemas, missing/unknown fields, null metadata and invalid tags fail closed. Existing metadata caps still apply to the larger serialized manifest.

Classification contains a required `tags` string array and required boolean `favourite`. Tags preserve spelling/order, permit Unicode, and are limited to 16 distinct labels per script, each 1–40 UTF-16 code units without commas, controls or surrounding whitespace. Host duplicate checks ignore case using ordinal comparison. The comma-separated desktop input trims labels and ignores empty separators before submitting; invalid duplicate/oversized labels are rejected. Tags are labels, not filesystem paths or executable content.

`script.classify` takes an active script ID, tags, favourite, expected workspace revision and upgrade-consent boolean. It checks the loaded manifest hash/revision, validates the full candidate, retains the checkpoint when needed, and atomically commits metadata. It never rewrites source files or executes anything; an external source edit remains untouched and is reviewed separately through Reload/Save. A stale or invalid request preserves committed metadata. Copy/save/move/recycle/restore operations retain classification; copies initially inherit it and can subsequently be changed independently. New v4 scripts start with empty tags and favourite false. Ordinary v4 script/folder deletes never downgrade the schema.

The UI provides explicit Save tags and favourite. Label edits have their own unsaved indicator and navigation/quit guard. Saving source text retains an unsaved label draft; saving labels requires a clean saved source buffer and keeps source content/Monaco undo state. Script/folder duplication and deletion require saved label drafts as well. OS termination can still lose unsaved labels or source: autosave/recovery is unfinished.

The script list combines direct selected-folder scope, case-insensitive name substring, language, case-insensitive exact tag and favourites-only filters with AND. The all-scripts view spans active folders. Only active scripts appear in the list/tag vocabulary. Clearing filters restores all active scripts in the current folder scope. Filters are local UI state and reset when selecting/opening a workspace. This is bounded metadata filtering, not indexed full-text/source search; saved collections, persistent search/index rebuild, recency filters and Windows performance acceptance remain unfinished.


## Saved collections and explicit v5 upgrade

The first `collection.create` explicitly confirms format v5, retains the exact pre-upgrade v1/v2/v3/v4 manifest through the existing checkpoint mechanism, and initializes the required `collections` array. Direct upgrades from v1–v3 also initialize every script's v4 classification across all live/recycle partitions. Existing tags, favourite state, folder/script identities, source hashes and deleted states are preserved. Ordinary operations on v1–v4 retain their existing schema until an explicit feature upgrade. V5 operations retain v5, including classification and folder/script recycling. Collections fields on older versions, absent/null arrays on v5 and unknown nested fields fail closed.

Each collection is `{id, name, filter}`. Filter fields are all required: `nameContains` (trimmed string, 0–120 UTF-16 units without controls), nullable `language` (JavaScript/Python/C# identifier), nullable `folderId`, nullable `tag` (same label rules as classification), and boolean `favouritesOnly`. Null folder means all active folders; a concrete folder means its direct scripts. Conditions combine with AND using the existing metadata-filter semantics. Names and tags match case-insensitively in the desktop view; tag matching is exact and name matching is substring-based. The current baseline saves one tag condition. Multiple-tag groups, recency and indexed source/text conditions are future extensions, not implicit fields.

Collections have stable GUID identities, globally unique among live/recycled folders/scripts/other collections, and case-insensitively unique names. The preview limit is 100 saved collections within the existing 1 MiB manifest cap. `collection.create`, `collection.update` and `collection.delete` take the expected workspace revision; create additionally takes upgrade consent. Updates keep identity while replacing the explicit name/filter; deletion removes only the saved filter definition and has no undo. All use manifest freshness checks and the same atomic commit point; no source files are written and scripts are never copied into a collection.

A concrete scope must reference a live folder or a folder retained in the folder recycle bin. Recycling/renaming/moving a folder retains the collection's original identity reference without widening to all folders. A scope in the recycle bin produces zero results with a visible explanation; restoration reactivates the same scope automatically. Tags absent from active scripts also give zero results, and their saved filter value remains visible. A dangling folder reference not present in either live/recycled metadata is rejected. Future purge/import work must handle these references explicitly.

The desktop can save the current working filters as a new collection, apply/reload a saved definition, rename/update it from current filters, and delete it after a native confirmation that defaults to Cancel. Working filters can differ from the selected collection; only explicit Update changes its persisted definition. Switching collections/filters leaves the open editor and unsaved source/label drafts intact. A currently applied deleted folder scope stays empty immediately after deletion; choosing a different working folder is explicit. Create script/folder is disabled in an unavailable scope. Reopen preserves definitions but resets the transient working selection.

Checkpoints/temp leftovers from a failed pre-commit upgrade are ignored/preserved on restart. Lost responses may have committed; reopen and inspect before retrying. Existing power-loss and local-filesystem limitations apply. This is saved metadata filtering, not the planned SQLite catalog/full-text index or search-performance acceptance.
