import { build } from 'esbuild';
import { rm, mkdir, copyFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['ui/main.tsx'], bundle: true, outfile: 'dist/app.js', format: 'esm', platform: 'browser', target: 'chrome140', loader: { '.ttf': 'file' } });
await build({ entryPoints: ['node_modules/monaco-editor/esm/vs/editor/editor.worker.js'], bundle: true, outfile: 'dist/editor.worker.js', format: 'iife', platform: 'browser', target: 'chrome140' });
await copyFile('ui/index.html', 'dist/index.html');
await copyFile('branding/assets/icons/icon-512.png', 'dist/icon.png');
