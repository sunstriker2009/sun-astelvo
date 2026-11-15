# ADR-007: bounded in-session editor tabs

Status: selected for the M2 tabs batch; recovery, formatters and Windows acceptance remain open.

Keep one Monaco model per open script, keyed by stable script identity, with at most 16 script tabs. A small empty read-only model keeps the editor mounted when no document is open. Each tab owns the last reviewed saved document/hash, draft name/language/folder, source model and undo stack, view state, and independent tag/favourite drafts. Switching tabs or choosing an already-open script restores that state without reading disk, saving or asking to discard. Successful saves retain the same model when its content matches the response. No workspace schema or host protocol change is needed.

Close a tab with its close button or Ctrl/Cmd+W; Ctrl+Tab and Ctrl+Shift+Tab cycle in opening order. Visible controls expose the active tab, dirty indicator and accessible close names. Closed models are disposed; closing the last tab leaves an empty read-only editor. Closing a tab retains the saved script in the workspace. Capacity is checked before reading a new script or persistently creating/duplicating one; existing tabs remain selectable at capacity.

Closing a dirty source/metadata/label tab requires discard consent, including inactive tabs. Workspace create/open/close, archive restore and app quit inspect all tabs. Cancellation or a failed native/host operation preserves every tab; all old models are cleared only after a successful workspace transition. Export and bulk folder duplicate/delete require all open tabs saved and reviewed. Script duplicate/delete retain their current-tab guards. Successful script/folder recycling disposes only affected tabs and selects a remaining tab when available.

A tab switch intentionally retains the reviewed snapshot. It does not silently reload external edits. Save still supplies the tab's expected source hash, so conflicting changes reject while retaining the draft. Explicit Reload guards only the current tab and replaces its reviewed content after consent; externally changed source still needs explicit Save adoption. No filesystem watcher, merge editor or crash recovery is established.

Tab state is memory-only. Closing a tab/workspace or quitting after consent discards its drafts and undo history; crashes can lose unsaved edits. Autosave/recovery, session restoration, tab reordering, formatting, runners and Windows accessibility/performance acceptance remain separate work. Renderer isolation is unchanged and does not sandbox future script execution.
