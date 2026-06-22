// ---------------------------------------------------------------------------
// MD4 (RFC 1320) — pure TypeScript implementation
// ---------------------------------------------------------------------------
// Used only to compute the NTLM / NT hash = MD4(UTF-16LE(password)). We ship
// our own rather than depend on a native crypto provider because modern
// OpenSSL builds (Node 18+/22) disable MD4, which breaks library shims in
// server/test environments. This operates on raw bytes and runs identically in
// the browser and in Node. MD4 is cryptographically broken — it is used here
// strictly to reproduce Windows' legacy NT hash, never for security.
// ---------------------------------------------------------------------------

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

/** Compute MD4 of a byte array, returning lowercase hex. */
export function md4Hex(bytes: number[]): string {
  const len = bytes.length;
  // Pre-processing: append 0x80, pad with zeros, append 64-bit length (bits).
  const withPadLen = ((len + 8) >> 6) + 1;
  const words = new Array<number>(withPadLen * 16).fill(0);
  for (let i = 0; i < len; i++) {
    words[i >> 2] |= (bytes[i] & 0xff) << ((i % 4) * 8);
  }
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[withPadLen * 16 - 2] = len * 8;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const add = (x: number, y: number) => (x + y) | 0;

  for (let i = 0; i < words.length; i += 16) {
    const blk = words.slice(i, i + 16);
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
    const G = (x: number, y: number, z: number) => (x & y) | (x & z) | (y & z);
    const H = (x: number, y: number, z: number) => x ^ y ^ z;

    // Round 1
    const r1 = (w: number, x: number, y: number, z: number, k: number, s: number) =>
      rotl(add(w, add(F(x, y, z), blk[k])), s);
    a = r1(a, b, c, d, 0, 3);
    d = r1(d, a, b, c, 1, 7);
    c = r1(c, d, a, b, 2, 11);
    b = r1(b, c, d, a, 3, 19);
    a = r1(a, b, c, d, 4, 3);
    d = r1(d, a, b, c, 5, 7);
    c = r1(c, d, a, b, 6, 11);
    b = r1(b, c, d, a, 7, 19);
    a = r1(a, b, c, d, 8, 3);
    d = r1(d, a, b, c, 9, 7);
    c = r1(c, d, a, b, 10, 11);
    b = r1(b, c, d, a, 11, 19);
    a = r1(a, b, c, d, 12, 3);
    d = r1(d, a, b, c, 13, 7);
    c = r1(c, d, a, b, 14, 11);
    b = r1(b, c, d, a, 15, 19);

    // Round 2
    const r2 = (w: number, x: number, y: number, z: number, k: number, s: number) =>
      rotl(add(w, add(add(G(x, y, z), blk[k]), 0x5a827999)), s);
    a = r2(a, b, c, d, 0, 3);
    d = r2(d, a, b, c, 4, 5);
    c = r2(c, d, a, b, 8, 9);
    b = r2(b, c, d, a, 12, 13);
    a = r2(a, b, c, d, 1, 3);
    d = r2(d, a, b, c, 5, 5);
    c = r2(c, d, a, b, 9, 9);
    b = r2(b, c, d, a, 13, 13);
    a = r2(a, b, c, d, 2, 3);
    d = r2(d, a, b, c, 6, 5);
    c = r2(c, d, a, b, 10, 9);
    b = r2(b, c, d, a, 14, 13);
    a = r2(a, b, c, d, 3, 3);
    d = r2(d, a, b, c, 7, 5);
    c = r2(c, d, a, b, 11, 9);
    b = r2(b, c, d, a, 15, 13);

    // Round 3
    const r3 = (w: number, x: number, y: number, z: number, k: number, s: number) =>
      rotl(add(w, add(add(H(x, y, z), blk[k]), 0x6ed9eba1)), s);
    a = r3(a, b, c, d, 0, 3);
    d = r3(d, a, b, c, 8, 9);
    c = r3(c, d, a, b, 4, 11);
    b = r3(b, c, d, a, 12, 15);
    a = r3(a, b, c, d, 2, 3);
    d = r3(d, a, b, c, 10, 9);
    c = r3(c, d, a, b, 6, 11);
    b = r3(b, c, d, a, 14, 15);
    a = r3(a, b, c, d, 1, 3);
    d = r3(d, a, b, c, 9, 9);
    c = r3(c, d, a, b, 5, 11);
    b = r3(b, c, d, a, 13, 15);
    a = r3(a, b, c, d, 3, 3);
    d = r3(d, a, b, c, 11, 9);
    c = r3(c, d, a, b, 7, 11);
    b = r3(b, c, d, a, 15, 15);

    a = add(a, aa);
    b = add(b, bb);
    c = add(c, cc);
    d = add(d, dd);
  }

  const toHex = (n: number) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const byte = (n >>> (i * 8)) & 0xff;
      s += byte.toString(16).padStart(2, '0');
    }
    return s;
  };
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}
