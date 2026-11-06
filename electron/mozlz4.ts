// Reads Mozilla's ".jsonlz4" files (Firefox and Zen session data):
// "mozLz40\0" magic, a 4-byte little-endian decompressed size, then one raw LZ4 block.

const MAGIC = 'mozLz40\0';

export function decodeMozLz4(buf: Buffer): string {
  if (buf.subarray(0, 8).toString('latin1') !== MAGIC) throw new Error('not a mozLz4 file');
  const size = buf.readUInt32LE(8);
  const out = Buffer.alloc(size);
  let ip = 12;
  let op = 0;
  while (ip < buf.length) {
    const token = buf[ip++];
    // Literals.
    let lit = token >> 4;
    if (lit === 15) {
      let b: number;
      do {
        b = buf[ip++];
        lit += b;
      } while (b === 255);
    }
    buf.copy(out, op, ip, ip + lit);
    ip += lit;
    op += lit;
    if (ip >= buf.length) break; // the last sequence has literals only
    // Match.
    const offset = buf[ip] | (buf[ip + 1] << 8);
    ip += 2;
    let len = (token & 15) + 4;
    if ((token & 15) === 15) {
      let b: number;
      do {
        b = buf[ip++];
        len += b;
      } while (b === 255);
    }
    // Byte by byte: matches may overlap their own output.
    for (let i = 0; i < len; i++, op++) out[op] = out[op - offset];
  }
  return out.toString('utf8', 0, op);
}
