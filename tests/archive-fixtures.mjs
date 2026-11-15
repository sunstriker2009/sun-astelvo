import { inflateRawSync } from 'node:zlib';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Small deterministic stored ZIP fixtures; deliberately supports invalid names/attributes.
export function makeZip(entries) {
  const local = [], central = []; let offset = 0;
  for (const item of entries) {
    const name = Buffer.from(item.name), bytes = Buffer.from(item.bytes ?? ''), crc = crc32(bytes);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20, 4); head.writeUInt16LE(item.flags ?? 0x800, 6);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(bytes.length, 18); head.writeUInt32LE(bytes.length, 22); head.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x314, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(item.flags ?? 0x800, 8);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(item.declaredLength ?? bytes.length, 24); directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(item.attributes ?? 0x81a40000, 38); directory.writeUInt32LE(offset, 42);
    local.push(head, name, bytes); central.push(directory, name); offset += head.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
// Inspect product exports for test assertions, never used by production extraction.
export function readZip(bytes) {
  const end = bytes.length - 22, count = bytes.readUInt16LE(end + 10); let offset = bytes.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const start = bytes.readUInt32LE(offset + 42), size = bytes.readUInt32LE(offset + 20), method = bytes.readUInt16LE(offset + 10);
    const dataStart = start + 30 + bytes.readUInt16LE(start + 26) + bytes.readUInt16LE(start + 28), packed = bytes.subarray(dataStart, dataStart + size);
    entries.push({ name, bytes: method === 8 ? inflateRawSync(packed) : Buffer.from(packed) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
