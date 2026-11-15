import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/csharp/register';
import 'monaco-editor/features/find/register';
import 'monaco-editor/features/quickCommand/register';
import './style.css';
import { AutomaticCheckpoint } from './automatic-checkpoint';

type Language = 'javascript' | 'python' | 'csharp';
type Folder = { id: string; name: string; parentId: string | null };
type Classification = { tags: string[]; favourite: boolean };
type Script = { id: string; name: string; language: Language; folderId: string | null; sourceHash: string; classification?: Classification };
type DeletedFolderTree = { rootId: string; folders: Folder[]; scripts: Script[]; deletedScripts: Script[] };
type ImportResult = { workspace: Workspace; importedIds: string[]; renamedCount: number };
type ExportResult = { archivePath: string; workspaceId: string; revision: number; schemaVersion: number; scriptCount: number; sourceBytes: number };
type SourceSearchResult = { workspaceId: string; revision: number; query: string; scriptIds: string[]; indexedCount: number; indexedBytes: number; rebuilt: boolean };
type CollectionFilter = { nameContains: string; language: Language | null; folderId: string | null; tag: string | null; favouritesOnly: boolean };
type SmartCollection = { id: string; name: string; filter: CollectionFilter };
type Workspace = { root: string; schemaVersion: number; id: string; name: string; revision: number; folders: Folder[]; scripts: Script[]; deletedScripts: Script[]; deletedFolderTrees: DeletedFolderTree[]; collections: SmartCollection[] };
type Document = Omit<Script, 'sourceHash'> & { content: string; hash: string; externalChanged: boolean; classification: Classification };
type RecoveryTab = { saved: Document; draft: Draft; content: string; tagText: string; favourite: boolean };
type RecoverySnapshot = { format: 'astelvo-draft-checkpoint'; version: 1; workspaceId: string; tabs: RecoveryTab[] };
type RecoveryState = { workspaceId: string; token: string | null; snapshot: RecoverySnapshot | null; problem: string | null };
type Draft = Pick<Document, 'name' | 'language' | 'folderId'>;
type EditorTab = { saved: Document; draft: Draft; model: monaco.editor.ITextModel; view: monaco.editor.ICodeEditorViewState | null; tagText: string; favourite: boolean; dirty: boolean; classificationDirty: boolean };
const maxTabs = 16;
type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
type WriteResult = { workspace: Workspace; document: Document };
type HostResponse = { ok: true; info: { product: string; protocol: number; runtime: string } } | { ok: false; message: string };
declare global {
  interface Window {
    astelvo: {
      hostInfo: () => Promise<HostResponse>;
      onPrepareClose: (handler: () => Promise<boolean>) => () => void;
      confirmDeleteFolder: (upgrade: boolean) => Promise<boolean>;
      confirmDeleteScript: (upgrade: boolean) => Promise<boolean>;
      confirmClassificationUpgrade: () => Promise<boolean>;
      confirmCollectionsUpgrade: () => Promise<boolean>;
      confirmDeleteCollection: () => Promise<boolean>;
      confirmDiscard: () => Promise<boolean>;
      confirmDiscardRecovery: () => Promise<boolean>;
      workspace: {
        readRecovery: () => Promise<Result<RecoveryState>>;
        writeRecovery: (input: { expectedToken: string | null; snapshot: RecoverySnapshot }) => Promise<Result<{workspaceId: string; token: string}>>;
        clearRecovery: (expectedToken: string | null) => Promise<Result<{workspaceId: string; token: null}>>;
        create: () => Promise<Result<Workspace>>;
        open: () => Promise<Result<Workspace>>;
        importScripts: (input: { folderId: string | null; expectedRevision: number; renameConflicts: boolean }) => Promise<Result<ImportResult>>;
        exportArchive: (expectedRevision: number) => Promise<Result<ExportResult>>;
        restoreArchive: () => Promise<Result<Workspace>>;
        close: () => Promise<Result<null>>;
        searchSource: (input: { query: string; expectedRevision: number; rebuild: boolean }) => Promise<Result<SourceSearchResult>>;
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
  const closeTabRef = useRef<() => void>(() => {});
  const cycleTabRef = useRef<(direction: number) => void>(() => {});
  const tabs = useRef(new Map<string, EditorTab>());
  const classificationRef = useRef({ tagText: '', favourite: false });
  const switchingModel = useRef(false);
  const emptyModel = useRef<monaco.editor.ITextModel | null>(null);
  const [tabList, setTabList] = useState<{ id: string; name: string; dirty: boolean; external: boolean }[]>([]);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const recoveryRef = useRef<RecoveryState | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const [automaticEnabled, setAutomaticEnabled] = useState(false);
  const [automaticReady, setAutomaticReady] = useState(false);
  const [automaticProblem, setAutomaticProblem] = useState(false);
  const prepareCloseRef = useRef<() => Promise<boolean>>(async () => false);
  const automatic = useRef<AutomaticCheckpoint | null>(null);
  if (!automatic.current) automatic.current = new AutomaticCheckpoint({
    capture: () => {
      const active = workspaceRef.current;
      if (!active) return null;
      const snapshot = captureDrafts(active.id);
      return snapshot ? JSON.stringify(snapshot) : null;
    },
    write: async serialized => {
      const snapshot = JSON.parse(serialized) as RecoverySnapshot;
      const reviewed = recoveryRef.current;
      if (!reviewed || reviewed.problem || reviewed.workspaceId !== snapshot.workspaceId) throw new Error('Read and review recovery before enabling automatic checkpoints.');
      const result = unwrap(await window.astelvo.workspace.writeRecovery({ expectedToken: reviewed.token, snapshot }));
      updateRecovery({ ...result, snapshot, problem: null });
      setRecoveryMessage(`Automatic checkpoint saved: ${snapshot.tabs.length} drafts. Saved scripts are unchanged.`);
    },
    available: () => !busyRef.current,
    state: setAutomaticEnabled,
    failed: cause => {
      setAutomaticReady(false); setAutomaticProblem(true);
      setRecoveryMessage(`Automatic checkpoints paused: ${cause instanceof Error ? cause.message : 'Write failed.'} Read the checkpoint before resuming. Current drafts remain in the editor.`);
    }
  });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  workspaceRef.current = workspace;
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
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceSearchActive, setSourceSearchActive] = useState(false);
  const [sourceResult, setSourceResult] = useState<SourceSearchResult | null>(null);
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
  const [renameImportConflicts, setRenameImportConflicts] = useState(false);
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
    dirtyRef.current = value; setDirty(value); syncTab();
  }
  function changeDraft(next: Draft) {
    draftRef.current = next; setDraft(next);
    const model = editor.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, next.language);
    calculateDirty();
  }
  function changeClassification(text: string, fav: boolean) {
    setTagText(text); setFavourite(fav); classificationRef.current = { tagText: text, favourite: fav };
    const saved = documentRef.current?.classification ?? { tags: [], favourite: false };
    const changed = text !== saved.tags.join(', ') || fav !== saved.favourite;
    classificationDirtyRef.current = changed; setClassificationDirty(changed); syncTab();
  }
  function clearSourceSearch() { setSourceQuery(''); setSourceSearchActive(false); setSourceResult(null); }
  function searchSource(rebuild: boolean) {
    if (!workspace) return;
    void run(async () => {
      setSourceSearchActive(true); setSourceResult(null);
      const result = unwrap(await window.astelvo.workspace.searchSource({ query: sourceQuery, expectedRevision: workspace.revision, rebuild }));
      if (result.workspaceId !== workspace.id) throw new Error('Search workspace changed. Reopen and search again.');
      setSourceResult(result); setStatus(`Source search matched ${result.scriptIds.length} of ${result.indexedCount} active saved scripts.${result.rebuilt ? ' Index rebuilt.' : ' Verified cached index.'}`);
    });
  }
  function clearFilters() { setFilterText(''); setFilterLanguage(''); setFilterTag(''); setFavouritesOnly(false); }
  function refreshTabs() {
    setTabList([...tabs.current].map(([id, tab]) => ({ id, name: tab.draft.name, dirty: tab.dirty || tab.classificationDirty, external: tab.saved.externalChanged })));
  }
  function syncTab() {
    const id = documentRef.current?.id;
    const tab = id ? tabs.current.get(id) : undefined;
    if (!tab) return;
    tab.saved = documentRef.current!; tab.draft = { ...draftRef.current };
    tab.view = editor.current?.saveViewState() ?? null;
    tab.tagText = classificationRef.current.tagText; tab.favourite = classificationRef.current.favourite;
    tab.dirty = dirtyRef.current; tab.classificationDirty = classificationDirtyRef.current;
    refreshTabs();
  }
  function hasPendingTabs(includeExternal = false) {
    syncTab();
    return [...tabs.current.values()].some(tab => tab.dirty || tab.classificationDirty || (includeExternal && tab.saved.externalChanged));
  }
  function activateTab(id: string) {
    syncTab();
    const tab = tabs.current.get(id)!;
    documentRef.current = tab.saved; setDocument(tab.saved);
    draftRef.current = { ...tab.draft }; setDraft(draftRef.current);
    classificationRef.current = { tagText: tab.tagText, favourite: tab.favourite };
    setTagText(tab.tagText); setFavourite(tab.favourite);
    classificationDirtyRef.current = tab.classificationDirty; setClassificationDirty(tab.classificationDirty);
    dirtyRef.current = tab.dirty; setDirty(tab.dirty);
    contentRef.current = tab.model.getValue();
    switchingModel.current = true;
    editor.current?.setModel(tab.model);
    switchingModel.current = false;
    if (tab.view) editor.current?.restoreViewState(tab.view);
    editor.current?.updateOptions({ readOnly: busyRef.current });
    setDuplicateName(''); setDuplicateFolder(tab.saved.folderId);
    refreshTabs(); editor.current?.focus();
  }
  function display(next: Document | null, preserveClassificationDraft = false) {
    if (!next) { clearTabs(); return; }
    syncTab();
    let tab = tabs.current.get(next.id);
    if (!tab) {
      tab = { saved: next, draft: { name: next.name, language: next.language, folderId: next.folderId },
        model: monaco.editor.createModel(next.content, next.language), view: null,
        tagText: next.classification.tags.join(', '), favourite: next.classification.favourite, dirty: false, classificationDirty: false };
      tabs.current.set(next.id, tab);
    } else {
      tab.saved = next; tab.draft = { name: next.name, language: next.language, folderId: next.folderId }; tab.dirty = false;
      // A successful save preserves this model's undo history, cursor and scroll.
      switchingModel.current = true;
      if (tab.model.getValue() !== next.content) { tab.model.setValue(next.content); tab.view = null; }
      monaco.editor.setModelLanguage(tab.model, next.language);
      switchingModel.current = false;
      if (!preserveClassificationDraft) { tab.tagText = next.classification.tags.join(', '); tab.favourite = next.classification.favourite; tab.classificationDirty = false; }
    }
    // Do not let activation stash the old active state over the new saved state.
    documentRef.current = null; activateTab(next.id);
  }
  function removeTabs(ids: string[]) {
    syncTab();
    const activeId = documentRef.current?.id;
    const removedActive = !!activeId && ids.includes(activeId);
    if (removedActive) {
      switchingModel.current = true; editor.current?.setModel(emptyModel.current); switchingModel.current = false;
      documentRef.current = null; setDocument(null); draftRef.current = emptyDraft; setDraft(emptyDraft);
      contentRef.current = ''; dirtyRef.current = false; setDirty(false);
      classificationDirtyRef.current = false; setClassificationDirty(false);
      classificationRef.current = { tagText: '', favourite: false }; setTagText(''); setFavourite(false);
      editor.current?.updateOptions({ readOnly: true });
    }
    for (const id of ids) { tabs.current.get(id)?.model.dispose(); tabs.current.delete(id); }
    if (removedActive && tabs.current.size) activateTab([...tabs.current.keys()].at(-1)!);
    refreshTabs();
  }
  function clearTabs() { removeTabs([...tabs.current.keys()]); }
  function ensureTabCapacity() {
    if (tabs.current.size >= maxTabs) throw new Error(`Close an editor tab before opening another (maximum ${maxTabs}).`);
  }
  function closeTab(id: string) {
    void run(async () => {
      syncTab(); const tab = tabs.current.get(id);
      if (!tab || ((tab.dirty || tab.classificationDirty) && !await window.astelvo.confirmDiscard())) return;
      removeTabs([id]); setStatus('Editor tab closed. Saved script remains in the workspace.');
    });
  }
  closeTabRef.current = () => { if (documentRef.current) closeTab(documentRef.current.id); };
  cycleTabRef.current = direction => {
    if (busyRef.current || tabs.current.size < 2) return;
    const ids = [...tabs.current.keys()]; const index = ids.indexOf(documentRef.current!.id);
    activateTab(ids[(index + direction + ids.length) % ids.length]);
  };
  useEffect(() => {
    emptyModel.current = monaco.editor.createModel('', 'javascript');
    const instance = monaco.editor.create(container.current!, { model: emptyModel.current, readOnly: true, theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 15 });
    editor.current = instance;
    const change = instance.onDidChangeModelContent(() => { if (switchingModel.current) return; contentRef.current = instance.getValue(); calculateDirty(); });
    const unsubscribeClose = window.astelvo.onPrepareClose(() => prepareCloseRef.current());
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if ([...tabs.current.values()].some(tab => tab.dirty || tab.classificationDirty)) { event.preventDefault(); event.returnValue = ''; }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') { event.preventDefault(); closeTabRef.current(); return; }
      if (event.ctrlKey && event.key === 'Tab') { event.preventDefault(); cycleTabRef.current(event.shiftKey ? -1 : 1); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', shortcut, true);
    return () => {
      automatic.current?.stop(); unsubscribeClose();
      change.dispose(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', shortcut, true);
      instance.dispose(); for (const tab of tabs.current.values()) tab.model.dispose(); tabs.current.clear(); emptyModel.current?.dispose(); emptyModel.current = null; editor.current = null;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    editor.current?.updateOptions({ readOnly: true });
    try { await automatic.current!.drain(); await action(); }
    catch (cause) {
      if (!(cause instanceof Error && 'code' in cause && cause.code === 'cancelled')) setError(cause instanceof Error ? cause.message : 'Workspace operation failed.');
    } finally {
      busyRef.current = false; setBusy(false);
      editor.current?.updateOptions({ readOnly: documentRef.current === null });
    }
  }
  async function canLeave() {
    await automatic.current!.flush();
    return !hasPendingTabs() || await window.astelvo.confirmDiscard();
  }
  prepareCloseRef.current = async () => {
    if (busyRef.current) { setError('Finish the current workspace operation before closing.'); return false; }
    let ready = false;
    await run(async () => { await automatic.current!.flush(); ready = true; });
    return ready;
  };
  function updateRecovery(next: RecoveryState | null) { recoveryRef.current = next; setRecovery(next); }
  function captureDrafts(workspaceId: string): RecoverySnapshot | null {
    const drafts = [...tabs.current.values()].filter(tab => tab.dirty || tab.classificationDirty || tab.saved.externalChanged);
    if (!drafts.length) return null;
    return { format: 'astelvo-draft-checkpoint', version: 1, workspaceId,
      tabs: drafts.map(tab => ({ saved: tab.saved, draft: tab.draft, content: tab.model.getValue(), tagText: tab.tagText, favourite: tab.favourite })) };
  }
  async function loadRecovery(next: Workspace) {
    automatic.current!.stop(); setAutomaticReady(false); setAutomaticProblem(false); updateRecovery(null); setRecoveryMessage('');
    try {
      const state = unwrap(await window.astelvo.workspace.readRecovery());
      if (state.workspaceId !== next.id) throw new Error('Recovery workspace changed. Read the checkpoint again.');
      updateRecovery(state); setAutomaticReady(state.token === null && state.problem === null);
      setRecoveryMessage(state.problem ?? (state.snapshot ? `${state.snapshot.tabs.length} checkpointed drafts available. Review before recovery or replacement.` : 'No draft checkpoint.'));
    } catch (cause) { setRecoveryMessage(cause instanceof Error ? cause.message : 'Checkpoint unavailable. Existing files were preserved.'); }
  }
  function checkpointDrafts() {
    if (!workspace || !recovery || recovery.problem) return;
    void run(async () => {
      automatic.current!.stop(); syncTab();
      const snapshot = captureDrafts(workspace.id);
      if (!snapshot) throw new Error('There are no unsaved or externally reviewed drafts to checkpoint. Existing checkpoint retained.');
      const result = unwrap(await window.astelvo.workspace.writeRecovery({ expectedToken: recoveryRef.current!.token, snapshot }));
      updateRecovery({ ...result, snapshot, problem: null }); setAutomaticReady(true); setAutomaticProblem(false);
      setRecoveryMessage(`Checkpoint saved: ${snapshot.tabs.length} drafts. Later edits require another checkpoint.`);
    });
  }
  function recoverDrafts() {
    if (!workspace || !recovery?.snapshot) return;
    void run(async () => {
      automatic.current!.stop();
      if (!await canLeave()) return;
      const records = recoveryRef.current!.snapshot!.tabs;
      // Validate the entire restore before touching any open models. A deleted
      // script must be restored through the organizer before its draft can return.
      for (const record of records) {
        if (!workspace.scripts.some(script => script.id === record.saved.id)) throw new Error('A checkpoint script is deleted or unavailable. Restore it from the recycle bin before recovering this checkpoint. All existing tabs and the checkpoint were retained.');
        unwrap(await window.astelvo.workspace.readScript(record.saved.id));
      }
      clearTabs();
      for (const record of records) {
        display(record.saved);
        editor.current?.setValue(record.content);
        changeDraft(record.draft); changeClassification(record.tagText, record.favourite);
      }
      setAutomaticReady(true); setAutomaticProblem(false);
      setRecoveryMessage(`Recovered ${records.length} drafts into tabs. Review before Save; stale source hashes still reject conflicting writes. The checkpoint is retained.`);
    });
  }
  function chooseWorkspace(create: boolean) {
    void run(async () => {
      if (!await canLeave()) return;
      const next = unwrap(await (create ? window.astelvo.workspace.create() : window.astelvo.workspace.open()));
      clearSourceSearch(); clearFilters(); setSelectedCollectionId(''); setCollectionName(''); setWorkspace(next); setSelectedFolder(null); setRestoreId(''); setRestoreTreeId(''); display(null); setStatus('Workspace opened. Select or create a script.'); await loadRecovery(next);
    });
  }
  function openScript(id: string, reload = false) {
    if (!reload && documentRef.current?.id === id) { editor.current?.focus(); return; }
    void run(async () => {
      if (!reload && tabs.current.has(id)) { activateTab(id); return; }
      if (reload && (dirtyRef.current || classificationDirtyRef.current) && !await window.astelvo.confirmDiscard()) return;
      if (!tabs.current.has(id)) ensureTabCapacity();
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
  const sourceSearchStale = sourceResult !== null && sourceResult.revision !== workspace?.revision;
  const sourceMatches = new Set(!sourceSearchStale ? sourceResult?.scriptIds ?? [] : []);
  const scripts = [...workspace?.scripts ?? []].filter(s => (!sourceSearchActive || sourceMatches.has(s.id)) && (selectedFolder === null || s.folderId === selectedFolder)
    && s.name.toLowerCase().includes(filterText.trim().toLowerCase())
    && (!filterLanguage || s.language === filterLanguage)
    && (!filterTag || s.classification?.tags.some(tag => tag.toLowerCase() === filterTag.toLowerCase()))
    && (!favouritesOnly || s.classification?.favourite)).sort((a, b) => a.name.localeCompare(b.name));

  return <main>
    <header><div className="brand"><img src="icon.png" alt="" /><div><strong>ASTELVO <small>by Sun</small></strong><p>Organize. Script. Explore.</p></div></div><span className="badge">Organizer preview</span></header>
    <div className="workspace-actions">
      <button disabled={busy} onClick={() => chooseWorkspace(true)}>New workspace</button>
      <button disabled={busy} onClick={() => chooseWorkspace(false)}>Open workspace</button>
      <button disabled={busy || !workspace || tabList.some(t => t.dirty || t.external)} onClick={() => {
        if (!workspace || hasPendingTabs(true)) return;
        void run(async () => {
          const result = unwrap(await window.astelvo.workspace.exportArchive(workspace.revision));
          if (result.workspaceId !== workspace.id) throw new Error('Export workspace changed. Reopen it before continuing.');
          setStatus(`Exported ${result.scriptCount} saved scripts, including recycle bins, to ${result.archivePath}`);
        });
      }}>Export workspace</button>
      <button disabled={busy} onClick={() => void run(async () => {
        if (!await canLeave()) return;
        const next = unwrap(await window.astelvo.workspace.restoreArchive());
        clearSourceSearch(); clearFilters(); setSelectedCollectionId(''); setCollectionName(''); setSelectedFolder(null); setRestoreId(''); setRestoreTreeId('');
        setWorkspace(next); display(null); setStatus('Workspace restored into the selected empty folder. Sources and metadata verified.'); await loadRecovery(next);
      })}>Restore archive</button>
      <span className="workspace-title" title={workspace?.root}>{workspace?.name ?? 'No workspace open'}</span>
      <button disabled={busy || !workspace} onClick={() => void run(async () => {
        if (!await canLeave()) return;
        unwrap(await window.astelvo.workspace.close()); display(null); setWorkspace(null); automatic.current!.stop(); updateRecovery(null); setAutomaticReady(false); setRecoveryMessage(''); setStatus('Workspace closed.');
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
            <p className="muted">Collections save the current folder/name/language/tag/favourite filters. Changing the working view only changes the saved definition when you choose Update collection. Source search is a separate unsaved condition; no recency filter yet.</p>
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
            <form onSubmit={event => { event.preventDefault(); if (hasPendingTabs(true)) return; void run(async () => {
              const next = unwrap(await window.astelvo.workspace.duplicateFolder({ id: selected.id, name: folderCopyName.trim(), parentId: folderCopyParent, expectedRevision: workspace!.revision }));
              const copied = next.workspace.folders.find(f => f.id === next.folderId)!;
              setWorkspace(next.workspace); setSelectedFolder(copied.id); setRenameName(copied.name); setMoveParent(copied.parentId);
              setFolderCopyName(''); setFolderCopyParent(copied.parentId); setStatus('Folder copied. Originals and the open editor are unchanged.');
            }); }}>
              <label>Folder copy name<input required maxLength={120} disabled={busy || tabList.some(t => t.dirty || t.external)} value={folderCopyName} onChange={event => setFolderCopyName(event.target.value)} /></label>
              <label>Folder copy destination<select disabled={busy || tabList.some(t => t.dirty || t.external)} value={folderCopyParent ?? ''} onChange={event => setFolderCopyParent(event.target.value || null)}>
                <option value="">Workspace root</option>{moveTargets.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}
              </select></label>
              <button disabled={busy || tabList.some(t => t.dirty || t.external)}>Duplicate folder</button>
            </form>
          </details>}
          {selected && <button disabled={busy || tabList.some(t => t.dirty || t.external)} onClick={() => {
            if (hasPendingTabs(true)) return;
            void run(async () => {
              const upgrade = workspace.schemaVersion < 3;
              if (!await window.astelvo.confirmDeleteFolder(upgrade)) return;
              const next = unwrap(await window.astelvo.workspace.deleteFolder({ id: selected.id, expectedRevision: workspace.revision, allowUpgrade: upgrade }));
              removeTabs([...tabs.current.keys()].filter(id => !next.scripts.some(s => s.id === id)));
              setWorkspace(next); if (currentCollection?.filter.folderId !== selectedFolder) selectFolder(null); setRestoreId(''); setStatus('Folder moved to recycle bin. Source files retained.');
            });
          }}>Delete folder</button>}
          <h2>Scripts</h2>
          <details><summary>Search saved source</summary>
            <form onSubmit={event => { event.preventDefault(); searchSource(false); }}>
              <label>Source words<input required maxLength={120} disabled={busy} value={sourceQuery} onChange={event => setSourceQuery(event.target.value)} /></label>
              <button disabled={busy || !sourceQuery.trim()}>Search source</button>
              <button type="button" disabled={busy || !sourceQuery.trim()} onClick={() => searchSource(true)}>Rebuild and search</button>
              <button type="button" disabled={busy || !sourceSearchActive} onClick={clearSourceSearch}>Clear source search</button>
            </form>
            <p className="muted">Saved active source only; 1–8 whole words combined with AND, without phrases or operators. Unsaved text and recycle bins are excluded. This condition is separate from saved collections.</p>
            {sourceSearchActive && <p className="source-search-status" role="note">{sourceSearchStale ? 'Workspace changed. Search again; previous results are hidden.' : sourceResult ? `Applied query: ${sourceResult.query}. ${sourceResult.scriptIds.length} source matches before metadata filters.` : 'Source results are hidden until a search succeeds. Rebuild cannot adopt external edits; reload/save those scripts first.'}</p>}
          </details>
          <details><summary>Filter scripts</summary>
            <label>Search script names<input maxLength={120} value={filterText} disabled={busy} onChange={event => setFilterText(event.target.value)} /></label>
            <label>Filter language<select value={filterLanguage} disabled={busy} onChange={event => setFilterLanguage(event.target.value)}><option value="">All languages</option>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Filter tag<select value={filterTag} disabled={busy} onChange={event => setFilterTag(event.target.value)}><option value="">All tags</option>{availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
            <label className="check-label"><input type="checkbox" checked={favouritesOnly} disabled={busy} onChange={event => setFavouritesOnly(event.target.checked)} />Favourites only</label>
            <p className="muted">{scripts.length} matching of {workspace.scripts.length} active scripts. Metadata filters combine with any active saved-source search.</p>
            <button disabled={busy} onClick={clearFilters}>Clear filters</button>
          </details>
          <details><summary>Import scripts</summary>
            <p className="muted">Import 1–32 local UTF-8 .js, .py or .cs files into {selectedFolder ? folderLabel(selectedFolder) || 'the selected folder' : 'the workspace root'}. Originals stay unchanged. No code is run. Existing scripts are never replaced.</p>
            <label className="check-label"><input type="checkbox" checked={renameImportConflicts} disabled={busy} onChange={event => setRenameImportConflicts(event.target.checked)} />Add numbered copies for name conflicts</label>
            <button disabled={busy || scopeUnavailable} onClick={() => void run(async () => {
              const next = unwrap(await window.astelvo.workspace.importScripts({ folderId: selectedFolder, expectedRevision: workspace.revision, renameConflicts: renameImportConflicts }));
              setWorkspace(next.workspace); setStatus(`Imported ${next.importedIds.length} scripts (${next.renamedCount} numbered copies). The open editor is unchanged; active filters may hide new scripts.`);
            })}>Choose files to import</button>
          </details>
          <details><summary>New script</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            ensureTabCapacity();
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
              ensureTabCapacity();
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
              setWorkspace(next); removeTabs([current.id]); setStatus('Script moved to recycle bin. Source files retained.');
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
        {workspace && <details className="recovery-panel"><summary>Draft recovery{automaticEnabled ? ' — automatic' : automaticProblem ? ' — automatic paused' : ''}{recovery?.snapshot ? ` (${recovery.snapshot.tabs.length})` : ''}</summary>
          <p>Checkpoint unsaved source, script fields and labels from every open tab. Optional automatic checkpoints replace the current checkpoint about every two seconds and flush before workspace changes or normal window close. Recover, replace or discard an existing checkpoint before enabling them. Checkpoints stay after Save/close/quit until replaced or discarded. Workspace exports contain saved scripts only.</p>
          <button disabled={busy} onClick={() => void run(async () => loadRecovery(workspace))}>Read checkpoint</button>
          <button disabled={busy || !recovery || !!recovery.problem || !tabList.some(tab => tab.dirty || tab.external)} onClick={checkpointDrafts}>{recovery?.snapshot ? 'Replace checkpoint with open drafts' : 'Checkpoint open drafts'}</button>
          <button disabled={busy || !recovery?.snapshot} onClick={recoverDrafts}>Recover checkpoint</button>
          <button disabled={busy || !recovery?.token} onClick={() => void run(async () => {
            automatic.current!.stop();
            if (!await window.astelvo.confirmDiscardRecovery()) return;
            const result = unwrap(await window.astelvo.workspace.clearRecovery(recoveryRef.current!.token));
            if (result.workspaceId !== workspace.id) throw new Error('Recovery workspace changed. Read the checkpoint again.');
            updateRecovery({ ...result, snapshot: null, problem: null }); setAutomaticReady(true); setAutomaticProblem(false); setRecoveryMessage('Checkpoint discarded. Open drafts and saved scripts are unchanged.');
          })}>Discard checkpoint</button>
          <button disabled={busy || (!automaticEnabled && !automaticReady)} onClick={() => void run(async () => {
            if (automaticEnabled) { automatic.current!.stop(); setRecoveryMessage('Automatic checkpoints stopped. Last acknowledged checkpoint retained.'); }
            else { setAutomaticProblem(false); automatic.current!.start(); }
          })}>{automaticEnabled ? 'Stop automatic checkpoints' : 'Start automatic checkpoints'}</button>
          <p role="note">{automaticEnabled ? 'Automatic checkpoints enabled for this workspace session. Unacknowledged edits can still be lost on a crash. ' : ''}{recoveryMessage}</p>
        </details>}

        <nav className="editor-tabs" aria-label="Open editor tabs">
          {tabList.map(tab => <div className="editor-tab" key={tab.id}>
            <button disabled={busy} aria-current={document?.id === tab.id ? 'page' : undefined} onClick={() => openScript(tab.id)} title="Switch tab; drafts and undo history are retained">{tab.name || '(unnamed)'}{tab.dirty ? ' ●' : ''}{tab.external ? ' ⚠' : ''}</button>
            <button disabled={busy} aria-label={`Close tab ${tab.name}`} onClick={() => closeTab(tab.id)}>×</button>
          </div>)}
        </nav>
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
