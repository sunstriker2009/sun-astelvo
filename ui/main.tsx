import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/csharp/register';
import './style.css';

type Language = 'javascript' | 'python' | 'csharp';
type Folder = { id: string; name: string; parentId: string | null };
type Script = { id: string; name: string; language: Language; folderId: string | null; sourceHash: string };
type Workspace = { root: string; schemaVersion: number; id: string; name: string; revision: number; folders: Folder[]; scripts: Script[] };
type Document = Omit<Script, 'sourceHash'> & { content: string; hash: string; externalChanged: boolean };
type Draft = Pick<Document, 'name' | 'language' | 'folderId'>;
type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
type WriteResult = { workspace: Workspace; document: Document };
type HostResponse = { ok: true; info: { product: string; protocol: number; runtime: string } } | { ok: false; message: string };
declare global {
  interface Window {
    astelvo: {
      hostInfo: () => Promise<HostResponse>;
      confirmDiscard: () => Promise<boolean>;
      workspace: {
        create: () => Promise<Result<Workspace>>;
        open: () => Promise<Result<Workspace>>;
        close: () => Promise<Result<null>>;
        createFolder: (input: { name: string; parentId: string | null }) => Promise<Result<Workspace>>;
        renameFolder: (input: { id: string; name: string }) => Promise<Result<Workspace>>;
        createScript: (input: Draft) => Promise<Result<WriteResult>>;
        readScript: (id: string) => Promise<Result<Document>>;
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
  const busyRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Create or open a workspace to get started.');
  const [error, setError] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [newLanguage, setNewLanguage] = useState<Language>('javascript');

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
  function display(next: Document | null) {
    documentRef.current = next; setDocument(next);
    draftRef.current = next ? { name: next.name, language: next.language, folderId: next.folderId } : emptyDraft;
    setDraft(draftRef.current);
    contentRef.current = next?.content ?? '';
    editor.current?.setValue(contentRef.current);
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
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; }
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
  async function canLeave() { return !dirtyRef.current || await window.astelvo.confirmDiscard(); }
  function chooseWorkspace(create: boolean) {
    void run(async () => {
      if (!await canLeave()) return;
      const next = unwrap(await (create ? window.astelvo.workspace.create() : window.astelvo.workspace.open()));
      setWorkspace(next); setSelectedFolder(null); display(null); setStatus('Workspace opened. Select or create a script.');
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
      setWorkspace(next.workspace); display(next.document); setStatus('Saved.');
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
  const scripts = [...workspace?.scripts ?? []].filter(s => selectedFolder === null || s.folderId === selectedFolder).sort((a, b) => a.name.localeCompare(b.name));

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
          <h2>Folders</h2>
          <nav aria-label="Workspace folders">
            <button className="folder" aria-pressed={selectedFolder === null} onClick={() => { setSelectedFolder(null); setRenameName(''); }}>All scripts</button>
            {folders.map(folder => <button className="folder" key={folder.id} aria-pressed={selectedFolder === folder.id} onClick={() => { setSelectedFolder(folder.id); setRenameName(folder.name); }}>{folderLabel(folder.id)}</button>)}
          </nav>
          <details><summary>New folder</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            setWorkspace(unwrap(await window.astelvo.workspace.createFolder({ name: folderName.trim(), parentId: selectedFolder }))); setFolderName(''); setStatus('Folder created.');
          }); }}>
            <label>New folder{selectedFolder ? ' inside selected folder' : ''}<input value={folderName} maxLength={120} required disabled={busy} onChange={e => setFolderName(e.target.value)} /></label>
            <button disabled={busy}>Add folder</button>
          </form></details>
          {selectedFolder && <form onSubmit={event => { event.preventDefault(); void run(async () => {
            setWorkspace(unwrap(await window.astelvo.workspace.renameFolder({ id: selectedFolder, name: renameName.trim() }))); setStatus('Folder renamed.');
          }); }}>
            <label>Rename selected folder<input required maxLength={120} value={renameName} disabled={busy} onChange={e => setRenameName(e.target.value)} /></label><button disabled={busy}>Rename</button>
          </form>}
          <h2>Scripts</h2>
          <details><summary>New script</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            if (!await canLeave()) return;
            const next = unwrap(await window.astelvo.workspace.createScript({ name: scriptName.trim(), language: newLanguage, folderId: selectedFolder }));
            setWorkspace(next.workspace); display(next.document); setScriptName(''); setStatus('Script created. Edit and press Ctrl/Cmd+S to save.');
          }); }}>
            <label>New script name<input required maxLength={120} value={scriptName} disabled={busy} onChange={e => setScriptName(e.target.value)} /></label>
            <label>New script language<select value={newLanguage} disabled={busy} onChange={e => setNewLanguage(e.target.value as Language)}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button disabled={busy}>Create script</button>
          </form></details>
          <nav aria-label="Saved scripts">{scripts.map(script => <button className="script" aria-pressed={document?.id === script.id} key={script.id} disabled={busy} onClick={() => openScript(script.id)}><span>{script.name}</span><small>{languages[script.language]}{script.folderId ? ' · ' + folderLabel(script.folderId) : ''}</small></button>)}</nav>
          {scripts.length === 0 && <p className="muted">No scripts here yet.</p>}
        </>}
      </aside>
      <section className="content">
        <div className="toolbar">
          <label className="script-name">Script name<input aria-label="Script name" value={draft.name} maxLength={120} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, name: e.target.value })} /></label>
          <label>Language<select value={draft.language} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, language: e.target.value as Language })}>{Object.entries(languages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Folder<select value={draft.folderId ?? ''} disabled={busy || !document} onChange={e => changeDraft({ ...draftRef.current, folderId: e.target.value || null })}><option value="">Workspace root</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folderLabel(folder.id)}</option>)}</select></label>
          <button disabled={busy || !document || (!dirty && !document.externalChanged)} onClick={save}>Save</button>
          <button disabled={busy || !document} onClick={() => document && openScript(document.id, true)}>Reload</button>
          <button disabled title="Script runners are planned">Run</button>
        </div>
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
