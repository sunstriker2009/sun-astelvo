import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises';
import { stagePortable } from './portable-layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!['win32', 'linux'].includes(process.platform) || !['x64', 'arm64'].includes(process.arch)) throw new Error('Build on Windows or Linux x64/arm64 for the matching target.');
const rid = `${process.platform === 'win32' ? 'win' : 'linux'}-${process.arch}`;
const artifacts = path.join(root, 'artifacts');
const hostDirectory = path.join(artifacts, 'host', rid);
function run(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(executable)} failed (${code})`)));
  });
}
await rm(hostDirectory, { recursive: true, force: true });
await run(process.env.ASTELVO_DOTNET ?? 'dotnet', ['publish', 'src/Sun.Workspace.Host', '-c', 'Release', '-r', rid, '--self-contained', 'true', '-p:PublishSingleFile=false', '-p:DebugType=None', '-o', hostDirectory]);
await run(process.execPath, ['tools/build.mjs']);
const config = JSON.parse(await readFile(path.join(hostDirectory, 'Sun.Workspace.Host.runtimeconfig.json'), 'utf8'));
if (!config.runtimeOptions?.includedFrameworks || config.runtimeOptions.framework) throw new Error('Expected self-contained .NET publish');
await stat(path.join(hostDirectory, process.platform === 'win32' ? 'coreclr.dll' : 'libcoreclr.so'));
await stat(path.join(hostDirectory, process.platform === 'win32' ? 'Sun.Workspace.Host.exe' : 'Sun.Workspace.Host'));
// Retain the notices for the actual runtime-pack version that was published.
const framework = config.runtimeOptions.includedFrameworks.find(item => item.name === 'Microsoft.NETCore.App');
if (!framework) throw new Error('Missing .NET runtime version');
const assets = JSON.parse(await readFile(path.join(root, 'src/Sun.Workspace.Host/obj/project.assets.json'), 'utf8'));
let noticesCopied = false;
for (const folder of Object.keys(assets.packageFolders ?? {})) {
  const pack = path.join(folder, `microsoft.netcore.app.runtime.${rid}`, framework.version);
  try { await stat(path.join(pack, 'LICENSE.TXT')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const file of ['LICENSE.TXT', 'THIRD-PARTY-NOTICES.TXT']) await cp(path.join(pack, file), path.join(hostDirectory, file));
  noticesCopied = true;
  break;
}
if (!noticesCopied) throw new Error('Published runtime-pack license notices not found');
const runtimeDirectory = path.join(root, 'node_modules/electron/dist');
const portable = path.join(artifacts, 'portable');
await mkdir(portable, { recursive: true });
const stage = await mkdtemp(path.join(portable, `.stage-${rid}-`));
const bundle = path.join(stage, 'bundle');
try {
  await stagePortable({ root, runtimeDirectory, hostDirectory, destination: bundle, platform: process.platform });
  const destination = path.join(portable, `ASTELVO-${rid}`);
  await rm(destination, { recursive: true, force: true });
  await rename(bundle, destination);
  console.log(`Portable preview ready: ${destination}`);
} finally { await rm(stage, { recursive: true, force: true }); }
