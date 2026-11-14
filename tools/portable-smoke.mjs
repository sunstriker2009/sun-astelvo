import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!['win32', 'linux'].includes(process.platform)) throw new Error('Unsupported portable platform');
const rid = `${process.platform === 'win32' ? 'win' : 'linux'}-${process.arch}`;
const directory = path.join(root, 'artifacts/portable', `ASTELVO-${rid}`);
const executable = path.join(directory, process.platform === 'win32' ? 'ASTELVO.exe' : 'astelvo');
// Only the packaged runtimes may satisfy this check. The parent is already Node;
// the launched Electron and .NET host have no Node/dotnet command on PATH.
const env = { ...process.env, PATH: '', ASTELVO_DOTNET: 'astelvo-missing-dotnet', DOTNET_ROOT: path.join(root, 'artifacts/no-installed-runtime') };
// Windows environment keys are case-insensitive; avoid duplicate Path/PATH keys.
for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
env.PATH = '';
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['--astelvo-smoke'], { cwd: directory, env, stdio: 'inherit', shell: false, windowsHide: true });
let timedOut = false;
const deadline = setTimeout(() => { timedOut = true; child.kill(); }, 30000);
child.once('error', error => { clearTimeout(deadline); console.error(error.message); process.exitCode = 1; });
child.once('close', code => { clearTimeout(deadline); process.exitCode = timedOut || code !== 0 ? 1 : 0; });
