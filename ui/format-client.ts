import { validFormatInput, validFormatResult } from './format-contract.ts';
import type { FormatResult } from './format-contract.ts';

export class FormatClient {
  private cancelActive: (() => void) | null = null;
  private nextId = 0;
  private readonly createWorker: () => Worker;
  private readonly timeoutMs: number;
  constructor(createWorker: () => Worker = () => new Worker('./formatter.worker.js'), timeoutMs = 5000) {
    this.createWorker = createWorker; this.timeoutMs = timeoutMs;
  }
  cancel(): boolean {
    const active = this.cancelActive;
    if (!active) return false;
    active(); return true;
  }
  format(content: string, cursorOffset: number): Promise<FormatResult> {
    if (this.cancelActive) return Promise.reject(new Error('Formatting is already in progress.'));
    if (!validFormatInput(content, cursorOffset)) return Promise.reject(new Error('Formatting requires a valid cursor and at most 256 KiB of UTF-8 source.'));
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const id = ++this.nextId;
      let settled = false;
      const finish = (error: Error | null, result?: FormatResult) => {
        if (settled) return; settled = true;
        clearTimeout(timer); worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
        worker.terminate(); this.cancelActive = null;
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => finish(new Error('Formatting timed out. Original buffer retained.')), this.timeoutMs);
      this.cancelActive = () => finish(Object.assign(new Error('Formatting cancelled.'), {code: 'cancelled'}));
      worker.onerror = () => finish(new Error('JavaScript formatter unavailable. Original buffer retained.'));
      worker.onmessageerror = () => finish(new Error('Invalid formatter response. Original buffer retained.'));
      worker.onmessage = event => {
        const value = event.data;
        if (!value || typeof value !== 'object' || Array.isArray(value) || value.id !== id || typeof value.ok !== 'boolean') {
          finish(new Error('Invalid formatter response. Original buffer retained.')); return;
        }
        if (value.ok && Object.keys(value).length === 4 && ['id', 'ok', 'formatted', 'cursorOffset'].every(key => Object.hasOwn(value, key)) && validFormatResult(value)) {
          finish(null, {formatted: value.formatted, cursorOffset: value.cursorOffset});
        } else if (!value.ok && Object.keys(value).length === 3 && typeof value.message === 'string' && value.message.length > 0 && value.message.length <= 400) {
          finish(new Error(value.message));
        } else finish(new Error('Invalid formatter response. Original buffer retained.'));
      };
      try { worker.postMessage({id, content, cursorOffset}); }
      catch { finish(new Error('JavaScript formatter could not start. Original buffer retained.')); }
    });
  }
}
