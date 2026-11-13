import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/csharp/register';
import './style.css';

type HostResponse = { ok: true; info: { product: string; protocol: number; runtime: string } } | { ok: false; message: string };
declare global { interface Window { astelvo: { hostInfo: () => Promise<HostResponse> }; MonacoEnvironment: { getWorkerUrl: () => string } } }
window.MonacoEnvironment = { getWorkerUrl: () => './editor.worker.js' };
function App() {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [status, setStatus] = useState('Not connected');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    editor.current = monaco.editor.create(container.current!, { value: '// Welcome to ASTELVO.\n// This foundation preview does not save or run scripts.\nconsole.log("Organize. Script. Explore.");\n', language: 'javascript', theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 15 });
    return () => { const model = editor.current?.getModel(); editor.current?.dispose(); model?.dispose(); };
  }, []);
  async function checkHost() {
    setBusy(true);
    try { const result = await window.astelvo.hostInfo(); setStatus(result.ok ? `${result.info.product} host · .NET ${result.info.runtime} · protocol ${result.info.protocol}` : result.message); }
    catch { setStatus('Desktop bridge unavailable. Launch using npm start.'); }
    finally { setBusy(false); }
  }
  return <main>
    <header><div><strong>ASTELVO <small>by Sun</small></strong><p>Organize. Script. Explore.</p></div><span className="badge">M0 · Foundation preview</span></header>
    <section className="workspace"><aside><h2>Script workspace</h2><p>Organization and saved scripts arrive in M1.</p><p className="muted">The editor buffer is temporary and will be lost when this window closes.</p></aside>
      <section className="content"><div className="toolbar"><span>Untitled</span><label>Language <select defaultValue="javascript" onChange={e => { const model = editor.current?.getModel(); if (model) monaco.editor.setModelLanguage(model, e.target.value); }}><option value="javascript">JavaScript</option><option value="python">Python</option><option value="csharp">C#</option></select></label><button disabled title="Runners arrive in M3/M4">Run</button></div><div className="editor" ref={container} aria-label="Script editor"/><footer><button onClick={() => void checkHost()} disabled={busy}>{busy ? 'Connecting…' : 'Check host connection'}</button><span role="status">{status}</span></footer></section>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
