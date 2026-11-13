import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { encodeFrame, FrameDecoder } from './protocol.mjs';

export class HostClient {
  #child;
  #pending = new Map();
  #stopped = false;
  #exit;
  constructor(executable, args = []) {
    this.#child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false });
    this.#exit = new Promise(resolve => this.#child.once('close', resolve));
    const decoder = new FrameDecoder();
    const fail = () => {
      this.#stopped = true;
      for (const p of this.#pending.values()) { clearTimeout(p.timer); p.reject(new Error('Workspace host disconnected')); }
      this.#pending.clear();
    };
    this.#child.once('error', fail);
    this.#child.once('close', fail);
    this.#child.stdin.on('error', fail);
    this.#child.stderr.resume(); // Drain without accumulating or exposing untrusted diagnostic output.
    this.#child.stdout.on('data', chunk => {
      try {
        for (const message of decoder.push(chunk)) {
          if (!message || message.version !== 1 || typeof message.id !== 'string') throw new Error('Invalid response');
          const pending = this.#pending.get(message.id);
          if (!pending) continue; // Timed-out requests may finish later.
          if (!message.error && !(message.result?.product === 'ASTELVO' && message.result?.protocol === 1 && typeof message.result.runtime === 'string')) throw new Error('Invalid host information');
          this.#pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error('Workspace host rejected request'));
          else pending.resolve(message.result);
        }
      } catch { fail(); this.#child.kill(); }
    });
  }
  info(timeoutMs = 5000) {
    if (this.#stopped) return Promise.reject(new Error('Workspace host disconnected'));
    if (this.#pending.size >= 8) return Promise.reject(new Error('Too many requests'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error('Workspace host timed out')); }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#child.stdin.write(encodeFrame({ version: 1, id, method: 'host.info' }));
    });
  }
  async close() {
    this.#stopped = true;
    this.#child.stdin.end();
    const timer = setTimeout(() => this.#child.kill(), 1000);
    try { await this.#exit; } finally { clearTimeout(timer); }
  }
}
