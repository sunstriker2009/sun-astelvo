import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameDecoder, encodeFrame, MAX_FRAME } from '../desktop/protocol.mjs';
test('fragmented Unicode and coalesced frames retain exact message boundaries', () => {
  const messages = [{ text: 'Hello 🌞 বাংলা' }, { text: 'second' }];
  const bytes = Buffer.concat(messages.map(encodeFrame));
  const decoder = new FrameDecoder();
  const actual = [];
  for (const byte of bytes) actual.push(...decoder.push(Buffer.from([byte])));
  assert.deepEqual(actual, messages);
  assert.deepEqual(new FrameDecoder().push(bytes), messages);
});
test('rejects oversized, empty and malformed frames before accepting messages', () => {
  for (const size of [0, MAX_FRAME + 1, 0xffffffff]) { const head = Buffer.alloc(4); head.writeUInt32BE(size); assert.throws(() => new FrameDecoder().push(head)); }
  assert.throws(() => new FrameDecoder().push(Buffer.from([0, 0, 0, 1, 123])));
});
