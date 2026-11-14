import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { hostLaunch } from '../desktop/launch-config.mjs';
import { stagePortable } from '../tools/portable-layout.mjs';
import { prepareElectronRuntime } from '../tools/prepare-electron.mjs';

test('fresh Electron package without dist is prepared before staging', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astelvo-fresh-electron-'));
  const packageDirectory = path.join(root, 'node_modules/electron');
  try {
    await mkdir(packageDirectory, { recursive: true });
    // Exercise the real local-installer process boundary with a fresh package
    // fixture. No network, registry or existing developer dist is required.
    await writeFile(path.join(packageDirectory, 'install.js'), `
      const fs = require('node:fs');
      const path = require('node:path');
      const dist = path.join(__dirname, 'dist');
      fs.mkdirSync(dist, { recursive: true });
      fs.writeFileSync(path.join(dist, process.platform === 'win32' ? 'electron.exe' : 'electron'), 'prepared-runtime');
    `);
    await assert.rejects(access(path.join(packageDirectory, 'dist')), { code: 'ENOENT' });
    const directory = await prepareElectronRuntime(root);
    assert.equal(await readFile(path.join(directory, process.platform === 'win32' ? 'electron.exe' : 'electron'), 'utf8'), 'prepared-runtime');
    await writeFile(path.join(packageDirectory, 'install.js'), 'process.exit(3);');
    await assert.rejects(prepareElectronRuntime(root), /runtime preparation failed \(3\)/);
    await rm(directory, { recursive: true });
    await writeFile(path.join(packageDirectory, 'install.js'), 'process.exit(0);');
    await assert.rejects(prepareElectronRuntime(root), /did not provide the native runtime/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('packaged launch uses the bundled host even with a developer override', () => {
  const previous = process.env.ASTELVO_DOTNET;
  process.env.ASTELVO_DOTNET = 'not-a-packaged-runtime';
  try {
    for (const platform of ['win32', 'linux']) {
      const result = hostLaunch({ appRoot: '/missing-checkout', resourcesPath: '/portable/resources', isPackaged: true, platform });
      assert.equal(result.executable, path.join('/portable/resources/host', platform === 'win32' ? 'Sun.Workspace.Host.exe' : 'Sun.Workspace.Host'));
      assert.deepEqual(result.args, []);
    }
  } finally { if (previous === undefined) delete process.env.ASTELVO_DOTNET; else process.env.ASTELVO_DOTNET = previous; }
});

for (const platform of ['win32', 'linux']) {
  test(`portable ${platform} layout is relocatable and excludes development material`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'astelvo-portable-'));
    const root = path.join(directory, 'checkout with spaces');
    const runtime = path.join(directory, 'electron');
    const host = path.join(directory, 'publish');
    const output = path.join(directory, 'portable with spaces');
    async function fixture(file, contents = 'fixture') {
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, contents);
    }
    try {
      await fixture(path.join(root, 'package.json'), JSON.stringify({ name: '@sun-workspace/desktop', version: '0.0.1', dependencies: { unwanted: '1.0.0' } }));
      for (const name of ['main.mjs', 'preload.cjs', 'protocol.mjs', 'host-client.mjs', 'launch-config.mjs', 'smoke-check.mjs', 'workspace-contract.mjs']) await fixture(path.join(root, 'desktop', name));
      await fixture(path.join(root, 'dist/index.html'));
      await fixture(path.join(root, 'dist/editor.worker.js'));
      await fixture(path.join(root, 'node_modules/private-development-file'));
      await fixture(path.join(root, '.env'), 'do-not-copy');
      await fixture(path.join(root, 'desktop/unlisted-file'), 'do-not-copy');
      await fixture(path.join(runtime, platform === 'win32' ? 'electron.exe' : 'electron'));
      if (platform === 'win32') await fixture(path.join(runtime, 'electron_wer.dll'));
      await fixture(path.join(runtime, 'resources/default_app.asar'));
      await fixture(path.join(runtime, 'LICENSE'), 'electron-license');
      await fixture(path.join(host, platform === 'win32' ? 'Sun.Workspace.Host.exe' : 'Sun.Workspace.Host'));
      await fixture(path.join(host, 'LICENSE.txt'), 'host-license');
      await fixture(path.join(host, 'nested/runtime-file'));
      await stagePortable({ root, runtimeDirectory: runtime, hostDirectory: host, destination: output, platform });
      await access(path.join(output, platform === 'win32' ? 'ASTELVO.exe' : 'astelvo'));
      if (platform === 'win32') await access(path.join(output, 'ASTELVO_wer.dll'));
      const application = path.join(output, 'resources/app');
      assert.equal(JSON.parse(await readFile(path.join(application, 'package.json'), 'utf8')).dependencies, undefined);
      await access(path.join(application, 'dist/editor.worker.js'));
      await access(path.join(output, 'resources/host/nested/runtime-file'));
      assert.equal(await readFile(path.join(output, 'LICENSE'), 'utf8'), 'electron-license');
      assert.equal(await readFile(path.join(output, 'resources/host/LICENSE.txt'), 'utf8'), 'host-license');
      for (const file of ['.env', 'node_modules', 'src', 'desktop/unlisted-file']) await assert.rejects(access(path.join(application, file)), { code: 'ENOENT' });
      await assert.rejects(access(path.join(output, 'resources/default_app.asar')), { code: 'ENOENT' });
      // The same destination cannot silently reuse stale runtime/application files.
      await assert.rejects(stagePortable({ root, runtimeDirectory: runtime, hostDirectory: host, destination: output, platform }), { code: 'ERR_FS_CP_EEXIST' });
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
