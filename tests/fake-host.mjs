import { FrameDecoder, encodeFrame } from '../desktop/protocol.mjs';
const decoder = new FrameDecoder();
process.stdin.on('data', chunk => {
  for (const request of decoder.push(chunk)) {
    if (process.argv[2] === 'silent') continue;
    if (process.argv[2] === 'exit') { process.exit(2); }
    process.stdout.write(encodeFrame({ version: 1, id: request.id, result: { product: 'wrong' } }));
  }
});
