import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

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
const diagnostics = path.join(root, 'artifacts/diagnostics');
mkdirSync(diagnostics, { recursive: true });
const log = path.join(diagnostics, 'portable-smoke.log');
writeFileSync(log, `ASTELVO portable smoke: ${rid}\nPATH empty; bundled runtime required.\n`);
let remaining = 1024 * 1024;
function record(chunk) {
  const bytes = Buffer.from(chunk).subarray(0, remaining);
  remaining -= bytes.length;
  if (bytes.length) { appendFileSync(log, bytes); process.stdout.write(bytes); }
}
const child = spawn(executable, ['--astelvo-smoke'], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
child.stdout.on('data', record);
child.stderr.on('data', record);
let timedOut = false;
const deadline = setTimeout(() => { timedOut = true; record('\nOuter smoke watchdog expired.\n'); child.kill(); }, 30000);
child.once('error', error => { clearTimeout(deadline); record(error.message + '\n'); process.exitCode = 1; });
child.once('close', (code, signal) => {
  clearTimeout(deadline);
  record(`\nExit code: ${code}; signal: ${signal}; watchdog: ${timedOut}\n`);
  console.log(`Smoke diagnostics: ${log}`);
  process.exitCode = timedOut || code !== 0 ? 1 : 0;
});
