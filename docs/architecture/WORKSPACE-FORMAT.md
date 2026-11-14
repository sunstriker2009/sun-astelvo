# Workspace format v1

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

Manifest fields are `format="astelvo-workspace"`, `schemaVersion=1`, nonempty GUID `id`, `name`, nonnegative `revision`, `folders` and `scripts`. Folder records contain `id`, `name`, nullable `parentId`. Script records contain `id`, `name`, `language`, nullable `folderId`, and lower-case SHA-256 `sourceHash`. Required fields, unknown fields, unsupported versions, duplicate identities/names, dangling folders and cycles are rejected. There is no silent migration or repair.

Names contain 1–120 UTF-16 code units, without controls, slashes, surrounding whitespace, or the special labels dot/dot-dot. Names must be unique ignoring case among scripts in the same folder or folders under the same parent. Folder and script names use separate namespaces.

## Save and restart

1. Compare the loaded manifest bytes with the current manifest hash; compare a saved script's actual source hash with the editor's expected hash.
2. Write a new source revision to a uniquely named temporary file in the destination directory, flush it to storage, then rename it into place. An existing revision is verified and never overwritten by the application.
3. Validate the candidate manifest, increment its revision, write/flush a temporary manifest, then replace `workspace.json` by same-directory rename.
4. Publish the updated in-memory snapshot only after manifest replacement.

The manifest replacement is the commit point. Interruption before it leaves the previous manifest/revision reachable; a source revision written before interruption becomes an ignored orphan. The app retains old content versions and does not automatically remove leftovers. A returned I/O error or lost/timed-out response can have an uncertain commit outcome: refresh/reopen and inspect before retrying. There are no automatic write retries.

This is copy-on-write recovery, not a journal spanning mutable source and metadata files. It assumes supported local filesystem rename semantics. File flushes do not establish a complete power-loss guarantee or cross-device/network atomicity. Backup/restore, fault-injected power-loss acceptance, retention and garbage collection remain future M1/M5 work.

## External changes and locking

An external source edit is loaded explicitly through Reload/read, returned with its actual hash, and marked as external. A stale editor save fails without replacing that external source. Once reviewed, saving creates a new revision and updates the manifest reference. Manual edits can modify historical revision bytes, so immutability describes application writes, not protection from other local programs.

External manifest changes require reopening the same workspace to refresh metadata. Failed workspace selection/open does not discard the current buffer or release the active workspace. A normal switch/close releases its lease; abrupt host death releases the OS handle. The lock file itself is intentionally retained to avoid inode replacement races. The lease coordinates ASTELVO writers; external tools need not honor it.

Existing symlinks/junctions on managed paths are rejected. Windows UNC roots are rejected. Network/cloud-synchronized workspaces are unsupported. Path checks are not a security boundary against a hostile process racing filesystem changes with the same OS permissions.

## Limits and bridge

- 256 KiB UTF-8 per script; 1 MiB serialized manifest.
- 200 folders and 1,000 scripts in this preview.
- Bounded 4 MiB length-prefixed JSON frames, eight pending client requests, five-second default request deadline. Larger frames accommodate JSON-escaped source text; they do not increase the script size limit.
- Host methods: information, workspace open/close, folder create/rename, script create/read/save. Script save also renames, changes language and moves between folders.
- Native folder selection supplies the open/create path. The renderer bridge exposes explicit methods with validated inputs and correlated, validated results.

SQLite/search indexing, tags, favourites, collections, duplicate/delete/restore, import/export, autosave and formatting/runners are not implemented by this slice. Save is explicit (button or Ctrl/Cmd+S). Switching/reloading dirty scripts asks before discarding. Normal window/app quit asks before losing dirty edits; cancelling quit keeps the host/lease usable. OS termination or a crash can still lose an unsaved editor buffer.

## Evidence

Real-host tests cover UTF-8 persistence, language/rename/move identity, folder rename, second-writer rejection, lease release after close and abrupt death, maximum-size JSON-escaped source, external source/manifest conflicts, unsupported schema, orphan/temp files, symlink/junction rejection and request bounds.

A real Electron editor acceptance entry creates an isolated temporary workspace through the normal renderer/native-picker bridge, creates a folder/script, types/saves, cancels a dirty quit, reloads, closes/reopens and renames the script. It is excluded from production bundles; dialog overrides exist only in that test entry. A wrapper requires an explicit success marker so an early exit-zero quit cannot pass acceptance.
