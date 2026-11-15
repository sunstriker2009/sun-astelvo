import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/csharp/register';
import 'monaco-editor/features/find/register';
import 'monaco-editor/features/quickCommand/register';
import './style.css';

type Language = 'javascript' | 'python' | 'csharp';
type Folder = { id: string; name: string; parentId: string | null };
type Classification = { tags: string[]; favourite: boolean };
type Script = { id: string; name: string; language: Language; folderId: string | null; sourceHash: string; classification?: Classification };
type DeletedFolderTree = { rootId: string; folders: Folder[]; scripts: Script[]; deletedScripts: Script[] };
type CollectionFilter = { nameContains: string; language: Language | null; folderId: string | null; tag: string | null; favouritesOnly: boolean };
type SmartCollection = { id: string; name: string; filter: CollectionFilter };
type Workspace = { root: string; schemaVersion: number; id: string; name: string; revision: number; folders: Folder[]; scripts: Script[]; deletedScripts: Script[]; deletedFolderTrees: DeletedFolderTree[]; collections: SmartCollection[] };
type Document = Omit<Script, 'sourceHash'> & { content: string; hash: string; externalChanged: boolean; classification: Classification };
type Draft = Pick<Document, 'name' | 'language' | 'folderId'>;
type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
type WriteResult = { workspace: Workspace; document: Document };
type HostResponse = { ok: true; info: { product: string; protocol: number; runtime: string } } | { ok: false; message: string };
declare global {
  interface Window {
    astelvo: {
      hostInfo: () => Promise<HostResponse>;
      confirmDeleteFolder: (upgrade: boolean) => Promise<boolean>;
      confirmDeleteScript: (upgrade: boolean) => Promise<boolean>;
      confirmClassificationUpgrade: () => Promise<boolean>;
      confirmCollectionsUpgrade: () => Promise<boolean>;
      confirmDeleteCollection: () => Promise<boolean>;
      confirmDiscard: () => Promise<boolean>;
      workspace: {
        create: () => Promise<Result<Workspace>>;
        open: () => Promise<Result<Workspace>>;
        close: () => Promise<Result<null>>;
        createCollection: (input: { name: string; filter: CollectionFilter; expectedRevision: number; allowUpgrade: boolean }) => Promise<Result<{ workspace: Workspace; collectionId: string }>>;
        updateCollection: (input: { id: string; name: string; filter: CollectionFilter; expectedRevision: number }) => Promise<Result<Workspace>>;
        deleteCollection: (input: { id: string; expectedRevision: number }) => Promise<Result<Workspace>>;
        createFolder: (input: { name: string; parentId: string | null }) => Promise<Result<Workspace>>;
        renameFolder: (input: { id: string; name: string }) => Promise<Result<Workspace>>;
        moveFolder: (input: { id: string; parentId: string | null }) => Promise<Result<Workspace>>;
        duplicateFolder: (input: { id: string; name: string; parentId: string | null; expectedRevision: number }) => Promise<Result<{ workspace: Workspace; folderId: string }>>;
        deleteFolder: (input: { id: string; expectedRevision: number; allowUpgrade: boolean }) => Promise<Result<Workspace>>;
        restoreFolder: (input: { id: string; name: string; parentId: string | null; expectedRevision: number }) => Promise<Result<Workspace>>;
        classifyScript: (input: { id: string; tags: string[]; favourite: boolean; expectedRevision: number; allowUpgrade: boolean }) => Promise<Result<Workspace>>;
        createScript: (input: Draft) => Promise<Result<WriteResult>>;
        readScript: (id: string) => Promise<Result<Document>>;
        duplicateScript: (input: { id: string; name: string; folderId: string | null; expectedHash: string }) => Promise<Result<WriteResult>>;
        deleteScript: (input: { id: string; expectedHash: string; expectedRevision: number; allowUpgrade: boolean }) => Promise<Result<Workspace>>;
        restoreScript: (input: { id: string; name: string; folderId: string | null; expectedRevision: number }) => Promise<Result<Workspace>>;
        saveScript: (input: Draft & { id: string; content: string; expectedHash: string }) => Promise<Result<WriteResult>>;
      };
    };
    MonacoEnvironment: { getWorkerUrl: () => string };
  }
}
window.MonacoEnvironment = { getWorkerUrl: () => './editor.worker.js' };
const languages: Record<Language, string> = { javascript: 'JavaScript', python: 'Python', csharp: 'C#' };
const emptyDraft: Draft = { name: '', language: 'javascript', folderId: null };
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw Object.assign(new Error(result.message), { code: result.code });
  return result.value;
}

function App() {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const documentRef = useRef<Document | null>(null);
  const draftRef = useRef<Draft>(emptyDraft);
  const contentRef = useRef('');
  const dirtyRef = useRef(false);
  const classificationDirtyRef = useRef(false);
  const busyRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Create or open a workspace to get started.');
  const [error, setError] = useState('');
  const [tagText, setTagText] = useState('');
  const [favourite, setFavourite] = useState(false);
  const [classificationDirty, setClassificationDirty] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [moveParent, setMoveParent] = useState<string | null>(null);
  const [folderCopyName, setFolderCopyName] = useState('');
  const [folderCopyParent, setFolderCopyParent] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [newLanguage, setNewLanguage] = useState<Language>('javascript');
  const [restoreTreeId, setRestoreTreeId] = useState('');
  const [restoreTreeName, setRestoreTreeName] = useState('');
  const [restoreTreeParent, setRestoreTreeParent] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState('');
  const [restoreName, setRestoreName] = useState('');
  const [restoreFolder, setRestoreFolder] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateFolder, setDuplicateFolder] = useState<string | null>(null);

  function calculateDirty() {
    const saved = documentRef.current;
    const fields = draftRef.current;
    const value = saved !== null && (saved.content !== contentRef.current || saved.name !== fields.name || saved.language !== fields.language || saved.folderId !== fields.folderId);
    dirtyRef.current = value; setDirty(value);
  }
  function changeDraft(next: Draft) {
    draftRef.current = next; setDraft(next);
    const model = editor.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, next.language);
    calculateDirty();
  }
  function changeClassification(text: string, fav: boolean) {
    setTagText(text); setFavourite(fav);
    const saved = documentRef.current?.classification ?? { tags: [], favourite: false };
    const changed = text !== saved.tags.join(', ') || fav !== saved.favourite;
    classificationDirtyRef.current = changed; setClassificationDirty(changed);
  }
  function clearFilters() { setFilterText(''); setFilterLanguage(''); setFilterTag(''); setFavouritesOnly(false); }
  function display(next: Document | null, preserveClassificationDraft = false) {
    const previousId = documentRef.current?.id;
    if (!preserveClassificationDraft || next?.id !== previousId) {
      setTagText(next?.classification.tags.join(', ') ?? ''); setFavourite(next?.classification.favourite ?? false);
      classificationDirtyRef.current = false; setClassificationDirty(false);
    }
    setDuplicateName(''); setDuplicateFolder(next?.folderId ?? null);
    documentRef.current = next; setDocument(next);
    draftRef.current = next ? { name: next.name, language: next.language, folderId: next.folderId } : emptyDraft;
    setDraft(draftRef.current);
    contentRef.current = next?.content ?? '';
    // Saving the same document must retain Monaco's undo stack, selection and scroll.
    // Switching documents or explicitly reloading still replaces the buffer.
    if (!next || next.id !== previousId || editor.current?.getValue() !== contentRef.current) {
      editor.current?.setValue(contentRef.current);
    }
    const model = editor.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, next?.language ?? 'javascript');
    editor.current?.updateOptions({ readOnly: !next || busyRef.current });
    dirtyRef.current = false; setDirty(false);
    if (next) editor.current?.focus();
  }
  useEffect(() => {
    const instance = monaco.editor.create(container.current!, { value: '', language: 'javascript', readOnly: true, theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 15 });
    editor.current = instance;
    const change = instance.onDidChangeModelContent(() => { contentRef.current = instance.getValue(); calculateDirty(); });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || classificationDirtyRef.current) { event.preventDefault(); event.returnValue = ''; }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', shortcut, true);
    return () => {
      change.dispose(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', shortcut, true);
      const model = instance.getModel(); instance.dispose(); model?.dispose(); editor.current = null;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    editor.current?.updateOptions({ readOnly: true });
    try { await action(); }
    catch (cause) {
      if (!(cause instanceof Error && 'code' in cause && cause.code === 'cancelled')) setError(cause instanceof Error ? cause.message : 'Workspace operation failed.');
    } finally {
      busyRef.current = false; setBusy(false);
      editor.current?.updateOptions({ readOnly: documentRef.current === null });
    }
  }
  async function canLeave() { return !(dirtyRef.current || classificationDirtyRef.current) || await window.astelvo.confirmDiscard(); }
  function chooseWorkspace(create: boolean) {
    void run(async () => {
      if (!await canLeave()) return;
      const next = unwrap(await (create ? window.astelvo.workspace.create() : window.astelvo.workspace.open()));
      clearFilters(); setSelectedCollectionId(''); setCollectionName(''); setWorkspace(next); setSelectedFolder(null); setRestoreId(''); setRestoreTreeId(''); display(null); setStatus('Workspace opened. Select or create a script.');
    });
  }
  function openScript(id: string, reload = false) {
    if (!reload && documentRef.current?.id === id) { editor.current?.focus(); return; }
    void run(async () => {
      if (!await canLeave()) return;
      const next = unwrap(await window.astelvo.workspace.readScript(id));
      display(next); setStatus(next.externalChanged ? 'External edits loaded. Saving will create a new revision.' : 'Script opened.');
    });
  }
  function save() {
    if (!documentRef.current || busyRef.current) return;
    void run(async () => {
      const current = documentRef.current!;
      const next = unwrap(await window.astelvo.workspace.saveScript({ ...draftRef.current, id: current.id, content: contentRef.current, expectedHash: current.hash }));
      setWorkspace(next.workspace); display(next.document, true); setStatus('Saved.');
    });
  }
  saveRef.current = save;
  const folderLabels = useMemo(() => {
    const byId = new Map((workspace?.folders ?? []).map(folder => [folder.id, folder]));
    return new Map([...byId.keys()].map(id => {
      const names: string[] = [];
      let current: string | null = id;
      for (let i = 0; current && i < 200; i++) {
        const folder = byId.get(current);
        if (!folder) break;
        names.unshift(folder.name); current = folder.parentId;
      }
      return [id, names.join(' / ')] as const;
    }));
  }, [workspace]);
  function folderLabel(id: string | null) { return id ? folderLabels.get(id) ?? '' : ''; }
  const folders = [...workspace?.folders ?? []].sort((a, b) => folderLabel(a.id).localeCompare(folderLabel(b.id)));
  function selectFolder(id: string | null) {
    const folder = workspace?.folders.find(f => f.id === id);
    setSelectedFolder(id); setRenameName(folder?.name ?? ''); setMoveParent(folder?.parentId ?? null);
    setFolderCopyName(''); setFolderCopyParent(folder?.parentId ?? null);
  }
  const selected = folders.find(f => f.id === selectedFolder);
  const moveTargets = folders.filter(folder => {
    let current: Folder | undefined = folder;
    for (let i = 0; current && i < 200; i++) {
      if (current.id === selectedFolder) return false;
      current = folders.find(f => f.id === current?.parentId);
    }
    return true;
  });
  const availableTags = [...new Set([...(workspace?.scripts ?? []).flatMap(s => s.classification?.tags ?? []), ...(filterTag ? [filterTag] : [])])].sort((a, b) => a.localeCompare(b));
  const currentCollection = workspace?.collections.find(c => c.id === selectedCollectionId);
  const currentFilter: CollectionFilter = { nameContains: filterText.trim(), language: (filterLanguage || null) as Language | null, folderId: selectedFolder, tag: filterTag || null, favouritesOnly };
  const scopeUnavailable = selectedFolder !== null && !workspace?.folders.some(f => f.id === selectedFolder);
  function applyCollection(collection: SmartCollection) {
    setSelectedCollectionId(collection.id); setCollectionName(collection.name); selectFolder(collection.filter.folderId);
    setFilterText(collection.filter.nameContains); setFilterLanguage(collection.filter.language ?? ''); setFilterTag(collection.filter.tag ?? ''); setFavouritesOnly(collection.filter.favouritesOnly);
    setStatus('Saved collection applied. Working filters can be changed without modifying its saved definition.');
  }
  const scripts = [...workspace?.scripts ?? []].filter(s => (selectedFolder === null || s.folderId === selectedFolder)
    && s.name.toLowerCase().includes(filterText.trim().toLowerCase())
    && (!filterLanguage || s.language === filterLanguage)
    && (!filterTag || s.classification?.tags.some(tag => tag.toLowerCase() === filterTag.toLowerCase()))
    && (!favouritesOnly || s.classification?.favourite)).sort((a, b) => a.name.localeCompare(b.name));

  return <main>
    <header><div className="brand"><img src="icon.png" alt="" /><div><strong>ASTELVO <small>by Sun</small></strong><p>Organize. Script. Explore.</p></div></div><span className="badge">Organizer preview</span></header>
    <div className="workspace-actions">
      <button disabled={busy} onClick={() => chooseWorkspace(true)}>New workspace</button>
      <button disabled={busy} onClick={() => chooseWorkspace(false)}>Open workspace</button>
      <span className="workspace-title" title={workspace?.root}>{workspace?.name ?? 'No workspace open'}</span>
      <button disabled={busy || !workspace} onClick={() => void run(async () => {
        if (!await canLeave()) return;
        unwrap(await window.astelvo.workspace.close()); display(null); setWorkspace(null); setStatus('Workspace closed.');
      })}>Close workspace</button>
    </div>
    <section className="workspace">
      <aside>
        {!workspace ? <p>Create a workspace in an empty local folder, or open one you already use.</p> : <>
          <details><summary>Saved collections</summary>
            <label>Saved collection<select disabled={busy} value={selectedCollectionId} onChange={event => {
              const collection = workspace.collections.find(c => c.id === event.target.value);
              if (collection) applyCollection(collection); else { setSelectedCollectionId(''); setCollectionName(''); }
            }}><option value="">Choose a collection</option>{[...workspace.collections].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <form onSubmit={event => { event.preventDefault(); void run(async () => {
              const upgrade = workspace.schemaVersion < 5;
              if (upgrade && !await window.astelvo.confirmCollectionsUpgrade()) return;
              const next = unwrap(await window.astelvo.workspace.createCollection({ name: collectionName.trim(), filter: currentFilter, expectedRevision: workspace.revision, allowUpgrade: upgrade }));
              setWorkspace(next.workspace); setSelectedCollectionId(next.collectionId); setCollectionName(next.workspace.collections.find(c => c.id === next.collectionId)!.name); setStatus('Collection saved from the current filters.');
            }); }}>
              <label>Collection name<input required maxLength={120} disabled={busy} value={collectionName} onChange={event => setCollectionName(event.target.value)} /></label>
              <button disabled={busy}>Save as new collection</button>
              <button type="button" disabled={busy || !currentCollection} onClick={() => void run(async () => {
                const next = unwrap(await window.astelvo.workspace.updateCollection({ id: selectedCollectionId, name: collectionName.trim(), filter: currentFilter, expectedRevision: workspace.revision }));
                setWorkspace(next); setCollectionName(next.collections.find(c => c.id === selectedCollectionId)!.name); setStatus('Collection name and filters updated.');
              })}>Update collection</button>
              <button type="button" disabled={busy || !currentCollection} onClick={() => currentCollection && applyCollection(currentCollection)}>Reload collection</button>
              <button type="button" disabled={busy || !currentCollection} onClick={() => void run(async () => {
                if (!await window.astelvo.confirmDeleteCollection()) return;
                setWorkspace(unwrap(await window.astelvo.workspace.deleteCollection({ id: selectedCollectionId, expectedRevision: workspace.revision })));
                setSelectedCollectionId(''); setCollectionName(''); setStatus('Collection deleted. Scripts and working filters are unchanged.');
              })}>Delete collection</button>
            </form>
            <p className="muted">Collections save the current folder/name/language/tag/favourite filters. Changing the working view only changes the saved definition when you choose Update collection. No source or recency search yet.</p>
          </details>
          {scopeUnavailable && <p role="note">This collection's folder is in the recycle bin. Restore it or select a live folder; results stay empty.</p>}
          <h2>Folders</h2>
          <nav aria-label="Workspace folders">
            <button className="folder" disabled={busy} aria-pressed={selectedFolder === null} onClick={() => selectFolder(null)}>All scripts</button>
            {folders.map(folder => <button className="folder" key={folder.id} disabled={busy} aria-pressed={selectedFolder === folder.id} onClick={() => selectFolder(folder.id)}>{folderLabel(folder.id)}</button>)}
          </nav>
          <details><summary>New folder</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            setWorkspace(unwrap(await window.astelvo.workspace.createFolder({ name: folderName.trim(), parentId: selectedFolder }))); setFolderName(''); setStatus('Folder created.');
          }); }}>
            <label>New folder{selectedFolder ? ' inside selected folder' : ''}<input value={folderName} maxLength={120} required disabled={busy} onChange={e => setFolderName(e.target.value)} /></label>
            <button disabled={busy || scopeUnavailable}>Add folder</button>
          </form></details>
          {selectedFolder && <form onSubmit={event => { event.preventDefault(); void run(async () => {
            setWorkspace(unwrap(await window.astelvo.workspace.renameFolder({ id: selectedFolder, name: renameName.trim() }))); setStatus('Folder renamed.');
          }); }}>
            <label>Rename selected folder<input required maxLength={120} value={renameName} disabled={busy} onChange={e => setRenameName(e.target.value)} /></label><button disabled={busy}>Rename</button>
          </form>}
          {selected && <details><summary>Move selected folder</summary>
            <form onSubmit={event => { event.preventDefault(); void run(async () => {
              setWorkspace(unwrap(await window.astelvo.workspace.moveFolder({ id: selected.id, parentId: moveParent })));
              setStatus('Folder moved. Script contents and unsaved edits are unchanged.');
            }); }}>
              <label>Destination folder<select value={moveParent ?? ''} disabled={busy} onChange={event => setMoveParent(event.target.value || null)}>
                <option value="">Workspace root</option>
                {moveTargets.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || moveParent === selected.parentId}>Move folder</button>
            </form>
          </details>}
          {selected && <details><summary>Duplicate selected folder</summary>
            <p className="muted">Copy saved scripts and nested folders. Save open edits first. Originals remain unchanged.</p>
            <form onSubmit={event => { event.preventDefault(); if (dirtyRef.current || classificationDirtyRef.current || documentRef.current?.externalChanged) return; void run(async () => {
              const next = unwrap(await window.astelvo.workspace.duplicateFolder({ id: selected.id, name: folderCopyName.trim(), parentId: folderCopyParent, expectedRevision: workspace!.revision }));
              const copied = next.workspace.folders.find(f => f.id === next.folderId)!;
              setWorkspace(next.workspace); setSelectedFolder(copied.id); setRenameName(copied.name); setMoveParent(copied.parentId);
              setFolderCopyName(''); setFolderCopyParent(copied.parentId); setStatus('Folder copied. Originals and the open editor are unchanged.');
            }); }}>
              <label>Folder copy name<input required maxLength={120} disabled={busy || dirty || classificationDirty || document?.externalChanged} value={folderCopyName} onChange={event => setFolderCopyName(event.target.value)} /></label>
              <label>Folder copy destination<select disabled={busy || dirty || classificationDirty || document?.externalChanged} value={folderCopyParent ?? ''} onChange={event => setFolderCopyParent(event.target.value || null)}>
                <option value="">Workspace root</option>{moveTargets.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || dirty || classificationDirty || document?.externalChanged}>Duplicate folder</button>
            </form>
          </details>}
          {selected && <button disabled={busy || dirty || classificationDirty || document?.externalChanged} onClick={() => {
            if (dirtyRef.current || classificationDirtyRef.current || documentRef.current?.externalChanged) return;
            void run(async () => {
              const upgrade = workspace.schemaVersion < 3;
              if (!await window.astelvo.confirmDeleteFolder(upgrade)) return;
              const next = unwrap(await window.astelvo.workspace.deleteFolder({ id: selected.id, expectedRevision: workspace.revision, allowUpgrade: upgrade }));
              if (documentRef.current && !next.scripts.some(s => s.id === documentRef.current!.id)) display(null);
              setWorkspace(next); if (currentCollection?.filter.folderId !== selectedFolder) selectFolder(null); setRestoreId(''); setStatus('Folder moved to recycle bin. Source files retained.');
            });
          }}>Delete folder</button>}
          <h2>Scripts</h2>
          <details><summary>Filter scripts</summary>
            <label>Search script names<input maxLength={120} value={filterText} disabled={busy} onChange={event => setFilterText(event.target.value)} /></label>
            <label>Filter language<select value={filterLanguage} disabled={busy} onChange={event => setFilterLanguage(event.target.value)}><option value="">All languages</option>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Filter tag<select value={filterTag} disabled={busy} onChange={event => setFilterTag(event.target.value)}><option value="">All tags</option>{availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
            <label className="check-label"><input type="checkbox" checked={favouritesOnly} disabled={busy} onChange={event => setFavouritesOnly(event.target.checked)} />Favourites only</label>
            <p className="muted">{scripts.length} matching of {workspace.scripts.length} active scripts. Name and metadata filters only.</p>
            <button disabled={busy} onClick={clearFilters}>Clear filters</button>
          </details>
          <details><summary>New script</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            if (!await canLeave()) return;
            const next = unwrap(await window.astelvo.workspace.createScript({ name: scriptName.trim(), language: newLanguage, folderId: selectedFolder }));
            setWorkspace(next.workspace); display(next.document); setScriptName(''); setStatus('Script created. Edit and press Ctrl/Cmd+S to save.');
          }); }}>
            <label>New script name<input required maxLength={120} value={scriptName} disabled={busy} onChange={e => setScriptName(e.target.value)} /></label>
            <label>New script language<select value={newLanguage} disabled={busy} onChange={e => setNewLanguage(e.target.value as Language)}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button disabled={busy || scopeUnavailable}>Create script</button>
          </form></details>
          {document && <details><summary>Duplicate current script</summary>
            <p className="muted">Copy the saved revision of {document.name}. Save any changes and resolve external edits first.</p>
            <form onSubmit={event => { event.preventDefault(); if (dirtyRef.current || classificationDirtyRef.current || documentRef.current?.externalChanged) return; void run(async () => {
              const current = documentRef.current!;
              const next = unwrap(await window.astelvo.workspace.duplicateScript({ id: current.id, name: duplicateName.trim(), folderId: duplicateFolder, expectedHash: current.hash }));
              setWorkspace(next.workspace); selectFolder(next.document.folderId); display(next.document); setStatus('Script duplicated. The original is unchanged.');
            }); }}>
              <label>Copy name<input required maxLength={120} disabled={busy || dirty || classificationDirty || document.externalChanged} value={duplicateName} onChange={event => setDuplicateName(event.target.value)} /></label>
              <label>Copy destination<select disabled={busy || dirty || classificationDirty || document.externalChanged} value={duplicateFolder ?? ''} onChange={event => setDuplicateFolder(event.target.value || null)}>
                <option value="">Workspace root</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || dirty || classificationDirty || document.externalChanged}>Duplicate script</button>
            </form>
          </details>}
          <nav aria-label="Saved scripts">{scripts.map(script => <button className="script" aria-pressed={document?.id === script.id} key={script.id} disabled={busy} onClick={() => openScript(script.id)}><span>{script.name}</span><small>{script.classification?.favourite ? '★ · ' : ''}{languages[script.language]}{script.classification?.tags.length ? ' · ' + script.classification.tags.join(', ') : ''}{script.folderId ? ' · ' + folderLabel(script.folderId) : ''}</small></button>)}</nav>
          {scripts.length === 0 && <p className="muted">No scripts match the current folder and filters.</p>}
          {document && <button disabled={busy || dirty || classificationDirty || document.externalChanged} onClick={() => {
            if (dirtyRef.current || classificationDirtyRef.current || documentRef.current?.externalChanged) return;
            void run(async () => {
              const upgrade = workspace.schemaVersion === 1;
              if (!await window.astelvo.confirmDeleteScript(upgrade)) return;
              const current = documentRef.current!;
              const next = unwrap(await window.astelvo.workspace.deleteScript({ id: current.id, expectedHash: current.hash, expectedRevision: workspace.revision, allowUpgrade: upgrade }));
              setWorkspace(next); display(null); setStatus('Script moved to recycle bin. Source files retained.');
            });
          }}>Delete script</button>}
          <details><summary>Deleted folders ({workspace.deletedFolderTrees.length})</summary>
            <p className="muted">Restore an entire subtree with original identities. Previously deleted scripts stay in the script recycle bin.</p>
            <form onSubmit={event => { event.preventDefault(); void run(async () => {
              const next = unwrap(await window.astelvo.workspace.restoreFolder({ id: restoreTreeId, name: restoreTreeName.trim(), parentId: restoreTreeParent, expectedRevision: workspace.revision }));
              setWorkspace(next); setRestoreTreeId(''); setRestoreTreeName(''); setStatus('Folder restored. Previously deleted scripts remain in the recycle bin.');
            }); }}>
              <label>Deleted folder<select disabled={busy} value={restoreTreeId} onChange={event => {
                const tree = workspace.deletedFolderTrees.find(t => t.rootId === event.target.value);
                const root = tree?.folders.find(f => f.id === tree.rootId);
                setRestoreTreeId(tree?.rootId ?? ''); setRestoreTreeName(root?.name ?? '');
                setRestoreTreeParent(root?.parentId && workspace.folders.some(f => f.id === root.parentId) ? root.parentId : null);
              }}><option value="">Choose a folder</option>{workspace.deletedFolderTrees.map(tree => <option key={tree.rootId} value={tree.rootId}>{tree.folders.find(f => f.id === tree.rootId)!.name} · {tree.folders.length} folders · {tree.scripts.length} scripts · {tree.rootId}</option>)}</select></label>
              <label>Folder restore name<input required maxLength={120} disabled={busy || !restoreTreeId} value={restoreTreeName} onChange={event => setRestoreTreeName(event.target.value)} /></label>
              <label>Folder restore destination<select disabled={busy || !restoreTreeId} value={restoreTreeParent ?? ''} onChange={event => setRestoreTreeParent(event.target.value || null)}>
                <option value="">Workspace root</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || !restoreTreeId}>Restore folder</button>
            </form>
          </details>
          <details><summary>Recycle bin ({workspace.deletedScripts.length})</summary>
            <p className="muted">Restore saved scripts with their original identity. Choose a free name and destination. Permanent deletion is unavailable.</p>
            <form onSubmit={event => { event.preventDefault(); void run(async () => {
              const next = unwrap(await window.astelvo.workspace.restoreScript({ id: restoreId, name: restoreName.trim(), folderId: restoreFolder, expectedRevision: workspace.revision }));
              setWorkspace(next); setRestoreId(''); setRestoreName(''); setStatus('Script restored. The open editor is unchanged.');
            }); }}>
              <label>Deleted script<select disabled={busy} value={restoreId} onChange={event => {
                const script = workspace.deletedScripts.find(s => s.id === event.target.value);
                setRestoreId(script?.id ?? ''); setRestoreName(script?.name ?? ''); setRestoreFolder(script?.folderId ?? null);
              }}><option value="">Choose a script</option>{workspace.deletedScripts.map(script => <option key={script.id} value={script.id}>{script.name} · {languages[script.language]} · {folderLabel(script.folderId) || 'Workspace root'} · {script.id}</option>)}</select></label>
              <label>Restore name<input required maxLength={120} disabled={busy || !restoreId} value={restoreName} onChange={event => setRestoreName(event.target.value)} /></label>
              <label>Restore destination<select disabled={busy || !restoreId} value={restoreFolder ?? ''} onChange={event => setRestoreFolder(event.target.value || null)}>
                <option value="">Workspace root</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || !restoreId}>Restore script</button>
            </form>
          </details>
        </>}
      </aside>
      <section className="content">
        <div className="toolbar">
          <label className="script-name">Script name<input aria-label="Script name" value={draft.name} maxLength={120} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, name: e.target.value })} /></label>
          <label>Language<select value={draft.language} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, language: e.target.value as Language })}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Folder<select value={draft.folderId ?? ''} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, folderId: e.target.value || null })}><option value="">Workspace root</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}</select></label>
          <button disabled={busy || !document || (!dirty && !document.externalChanged)} onClick={save}>Save</button>
          <button disabled={busy || !document} onClick={() => document && openScript(document.id, true)}>Reload</button>
          <button disabled={busy || !document} onClick={() => { editor.current?.focus(); editor.current?.trigger('toolbar', 'actions.find', null); }}>Find</button>
          <button disabled={busy || !document} onClick={() => { editor.current?.focus(); editor.current?.trigger('toolbar', 'editor.action.startFindReplaceAction', null); }}>Replace</button>
          <button disabled={busy || !document} onClick={() => { editor.current?.focus(); editor.current?.trigger('toolbar', 'editor.action.quickCommand', null); }}>Commands</button>
          <button disabled title="Script runners are planned">Run</button>
        </div>
        {document && workspace && <details className="classification-panel"><summary>Tags and favourite{classificationDirty ? ' — unsaved' : ''}</summary>
          <form onSubmit={event => { event.preventDefault(); if (dirtyRef.current || documentRef.current?.externalChanged) return; void run(async () => {
            const current = documentRef.current!;
            const upgrade = workspace.schemaVersion < 4;
            if (upgrade && !await window.astelvo.confirmClassificationUpgrade()) return;
            const tags = tagText.split(',').map(tag => tag.trim()).filter(Boolean);
            const next = unwrap(await window.astelvo.workspace.classifyScript({ id: current.id, tags, favourite, expectedRevision: workspace.revision, allowUpgrade: upgrade }));
            const saved = next.scripts.find(s => s.id === current.id)!;
            setWorkspace(next); display({ ...current, classification: saved.classification! }); setStatus('Tags and favourite saved. Source content unchanged.');
          }); }}>
            <label>Script tags (comma separated)<input maxLength={656} value={tagText} disabled={busy} onChange={event => changeClassification(event.target.value, favourite)} /></label>
            <label className="check-label"><input type="checkbox" checked={favourite} disabled={busy} onChange={event => changeClassification(tagText, event.target.checked)} />Favourite script</label>
            <button disabled={busy || dirty || document.externalChanged || !classificationDirty}>Save tags and favourite</button>
            <p className="muted">Up to 16 distinct tags, 40 characters each. Save script edits first. {classificationDirty ? 'Tags/favourite changes are unsaved.' : ''}</p>
          </form>
        </details>}
        <div className="editor" ref={container} aria-label="Script editor" />
        {error && <div className="error" role="alert">{error}</div>}
        <footer><span className={dirty ? 'unsaved' : ''}>{document ? dirty ? 'Unsaved changes' : 'Saved' : 'Select a script'}</span><span role="status">{busy ? 'Working…' : status}</span><button disabled={busy} onClick={() => void run(async () => {
          const result = await window.astelvo.hostInfo(); setStatus(result.ok ? 'Workspace host ready.' : result.message);
        })}>Check connection</button></footer>
      </section>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
