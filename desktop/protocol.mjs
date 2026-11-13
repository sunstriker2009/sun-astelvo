export const MAX_FRAME = 4096;

export function encodeFrame(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  if (!body.length || body.length > MAX_FRAME) throw new Error('Invalid frame length');
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  return Buffer.concat([head, body]);
}

export class FrameDecoder {
  #buffer = Buffer.alloc(0);
  push(chunk) {
    // Process incrementally: neither a partial header nor body can grow beyond a frame.
    const frames = [];
    let offset = 0;
    while (offset < chunk.length) {
      const target = this.#buffer.length < 4 ? 4 : 4 + this.#buffer.readUInt32BE(0);
      const count = Math.min(target - this.#buffer.length, chunk.length - offset);
      this.#buffer = Buffer.concat([this.#buffer, chunk.subarray(offset, offset + count)]);
      offset += count;
      if (this.#buffer.length < 4) continue;
      const length = this.#buffer.readUInt32BE(0);
      if (!length || length > MAX_FRAME) throw new Error('Invalid frame length');
      if (this.#buffer.length === length + 4) {
        frames.push(JSON.parse(this.#buffer.subarray(4).toString('utf8')));
        this.#buffer = Buffer.alloc(0);
      }
    }
    return frames;
  }
}
