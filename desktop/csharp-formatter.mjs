import { HostClient } from './host-client.mjs';
import { assertRequest } from './workspace-contract.mjs';

// A dedicated parser/formatter process, never the workspace's leased worker.
export class CsharpFormatter {
  #active = null;
  constructor(launch, createClient = spec => new HostClient(spec.executable, [...spec.args, '--format-csharp'], {env: spec.env ?? process.env}), timeoutMs = 5000) {
    this.launch = launch; this.createClient = createClient; this.timeoutMs = timeoutMs;
  }
  format(input) {
    try { assertRequest('format.csharp', input); } catch (error) { return Promise.reject(error); }
    if (this.#active) return Promise.reject(Object.assign(new Error('C# formatting is already active or cleanup is unverified.'), {code: 'busy'}));
    const job = {client: this.createClient(this.launch()), cancelled: false, stop: null, finished: null};
    this.#active = job;
    job.finished = (async () => {
      let result, failure;
      try { result = await job.client.request('format.csharp', input, this.timeoutMs); }
      catch (error) { failure = error; }
      finally {
        // Do not announce a result or release the slot until process exit was
        // observed. A failed cleanup leaves the slot blocked and remains visible.
        await this.#stop(job);
        if (this.#active === job) this.#active = null;
      }
      // Cancellation can arrive after the response, while exit is being checked.
      if (job.cancelled) throw Object.assign(new Error('C# formatting cancelled.'), {code: 'cancelled'});
      if (failure?.message?.includes('timed out')) throw Object.assign(new Error('C# formatting timed out. Original buffer retained.'), {code: 'timed_out'});
      if (failure) throw failure;
      return result;
    })();
    return job.finished;
  }
  #stop(job) { return job.stop ??= job.client.terminate(); }
  async cancel() {
    const job = this.#active;
    if (!job) return false;
    job.cancelled = true;
    await this.#stop(job);
    await job.finished.catch(() => {});
    return true;
  }
}
