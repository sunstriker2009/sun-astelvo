import path from 'node:path';
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

// Electron 45 installs its binary lazily. Packaging copies dist directly rather
// than invoking the Electron CLI, so explicitly run the pinned local installer.
export async function prepareElectronRuntime(root) {
  const packageDirectory = path.join(root, 'node_modules/electron');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(packageDirectory, 'install.js')], { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Electron runtime preparation failed (${code}). Check the installer output above.`)));
  });
  const directory = path.join(packageDirectory, 'dist');
  const executable = path.join(directory, process.platform === 'win32' ? 'electron.exe' : 'electron');
  try {
    if (!(await stat(executable)).isFile()) throw new Error('Not an executable file');
  } catch (cause) {
    throw new Error('Electron installer did not provide the native runtime. Remove cross-platform Electron install overrides and retry packaging.', { cause });
  }
  return directory;
}
