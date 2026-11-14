import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { encodeFrame, FrameDecoder } from './protocol.mjs';
import { assertRequest, assertResult } from './workspace-contract.mjs';

export class HostClient {
  #child;
  #pending = new Map();
  #stopped = false;
  #exit;
  constructor(executable, args = [], { env = process.env } = {}) {
    this.#child = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false });
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
          if (message.error) {
            if (typeof message.error.code !== 'string' || message.error.code.length > 40 || typeof message.error.message !== 'string' || message.error.message.length > 500) throw new Error('Invalid host error');
          } else assertResult(pending.method, message.result, pending.params);
          this.#pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(Object.assign(new Error(message.error.message), { code: message.error.code }));
          else pending.resolve(message.result);
        }
      } catch { fail(); this.#child.kill(); }
    });
  }
  info(timeoutMs = 5000) {
    return this.request('host.info', {}, timeoutMs);
  }
  request(method, params = {}, timeoutMs = 5000) {
    try { assertRequest(method, params); } catch (error) { return Promise.reject(error); }
    if (this.#stopped) return Promise.reject(new Error('Workspace host disconnected'));
    if (this.#pending.size >= 8) return Promise.reject(new Error('Too many requests'));
    const id = randomUUID();
    let frame;
    try { frame = encodeFrame({ version: 1, id, method, params }); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error('Workspace host timed out')); }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer, method, params });
      this.#child.stdin.write(frame);
    });
  }
  async close() {
    this.#stopped = true;
    this.#child.stdin.end();
    const timer = setTimeout(() => this.#child.kill(), 1000);
    try { await this.#exit; } finally { clearTimeout(timer); }
  }
}
