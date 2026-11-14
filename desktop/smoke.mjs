import { app } from 'electron';
app.commandLine.appendSwitch('astelvo-smoke');
await import('./main.mjs');
