// Owns timing and one in-flight write. It never owns workspace data or retries
// failed writes; the caller captures the current workspace and recovery token.
export class AutomaticCheckpoint {
  enabled = false;
  private pending: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failure: unknown = null;
  private acknowledged: string | null = null;
  private readonly options: {
    capture: () => string | null;
    write: (snapshot: string) => Promise<void>;
    available: () => boolean;
    state: (enabled: boolean) => void;
    failed: (error: unknown) => void;
    schedule?: (tick: () => void) => ReturnType<typeof setInterval>;
    cancel?: (timer: ReturnType<typeof setInterval>) => void;
  };
  constructor(options: AutomaticCheckpoint['options']) { this.options = options; }
  start() {
    if (this.enabled) return;
    this.failure = null; this.acknowledged = null;
    this.enabled = true; this.options.state(true);
    this.timer = this.options.schedule ? this.options.schedule(() => this.tick()) : setInterval(() => this.tick(), 2000);
  }
  stop() {
    this.enabled = false; this.failure = null;
    if (this.timer !== null) (this.options.cancel ?? clearInterval)(this.timer);
    this.timer = null; this.options.state(false);
  }
  async drain() { await this.pending?.catch(() => {}); }
  async flush() {
    if (!this.enabled) { await this.drain(); if (this.failure !== null) throw this.failure; return; }
    // A write already underway may contain an older draft. Capture again after
    // its acknowledgement, with the caller holding foreground editing frozen.
    if (this.pending) await this.pending;
    if (this.enabled) await this.writeLatest();
  }
  private tick() {
    if (!this.enabled || this.pending || !this.options.available()) return;
    void this.writeLatest().catch(() => {});
  }
  private writeLatest(): Promise<void> {
    const work = async () => {
      const snapshot = this.options.capture();
      if (snapshot === null || snapshot === this.acknowledged) return;
      await this.options.write(snapshot);
      this.acknowledged = snapshot;
    };
    // Defer capture until pending is installed, even if capture throws.
    const promise = Promise.resolve().then(work).catch(error => {
      this.stop(); this.failure = error; this.options.failed(error); throw error;
    });
    this.pending = promise;
    void promise.finally(() => { if (this.pending === promise) this.pending = null; }).catch(() => {});
    return promise;
  }
}
