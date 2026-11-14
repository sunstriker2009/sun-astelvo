import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/electron/cli.js', 'desktop/workspace-smoke.mjs', ...process.argv.slice(2)], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
let output = '';
child.stdout.on('data', chunk => { process.stdout.write(chunk); if (output.length < 1024 * 1024) output += chunk.toString(); });
child.stderr.on('data', chunk => process.stderr.write(chunk));
const timer = setTimeout(() => child.kill(), 45000);
child.once('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.once('close', code => {
  clearTimeout(timer);
  // A premature app.quit() must not turn incomplete acceptance into exit-0 success.
  process.exitCode = code === 0 && output.includes('Workspace editor smoke passed:') ? 0 : 1;
});
