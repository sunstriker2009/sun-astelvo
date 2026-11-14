import path from 'node:path';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

// Copy an explicit application allowlist, complete Electron and complete .NET runtime.
const desktopFiles = ['main.mjs', 'preload.cjs', 'protocol.mjs', 'host-client.mjs', 'launch-config.mjs', 'smoke-check.mjs', 'workspace-contract.mjs'];

export async function stagePortable({ root, runtimeDirectory, hostDirectory, destination, platform }) {
  if (!['win32', 'linux'].includes(platform)) throw new Error('Unsupported portable platform');
  await cp(runtimeDirectory, destination, { recursive: true, force: false, errorOnExist: true });
  const resources = path.join(destination, 'resources');
  await rm(path.join(resources, 'default_app.asar'), { force: true });
  const application = path.join(resources, 'app');
  await mkdir(path.join(application, 'desktop'), { recursive: true });
  for (const file of desktopFiles) await cp(path.join(root, 'desktop', file), path.join(application, 'desktop', file));
  await cp(path.join(root, 'dist'), path.join(application, 'dist'), { recursive: true });
  await cp(hostDirectory, path.join(resources, 'host'), { recursive: true });
  const { name, version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await writeFile(path.join(application, 'package.json'), JSON.stringify({ name, version, private: true, type: 'module', main: 'desktop/main.mjs', productName: 'ASTELVO by Sun' }, null, 2) + '\n');
  await rename(path.join(destination, platform === 'win32' ? 'electron.exe' : 'electron'), path.join(destination, platform === 'win32' ? 'ASTELVO.exe' : 'astelvo'));
  if (platform === 'win32') {
    try { await rename(path.join(destination, 'electron_wer.dll'), path.join(destination, 'ASTELVO_wer.dll')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeFile(path.join(destination, 'PORTABLE-NOTES.txt'), `ASTELVO by Sun ${version} — M0 portable preview\n\nExtract the whole folder, then launch ${platform === 'win32' ? 'ASTELVO.exe' : './astelvo'}.\nNode.js and .NET are bundled; no SDK or runtime installation is required.\nCreate/open a local workspace and save scripts explicitly with Ctrl/Cmd+S. Unsaved edits can be lost on a crash. Script execution is not implemented.\nThis is an unsigned portable spike, not an installer or a production release.\nThe native executable still carries Electron's default resource icon/metadata.\nFor acceptance use --astelvo-smoke; exit 0 means Monaco and bundled host IPC passed.\nKeep Electron and .NET license notices with the bundle.\n`);
}
