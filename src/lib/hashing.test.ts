import { describe, it, expect } from 'vitest';
import { hashAll, hashWith, ntlm, utf16leBytes } from './hashing';

// Well-known digests of the literal string "password".
const PASSWORD = 'password';
const VECTORS = {
  md5: '5f4dcc3b5aa765d61d8327deb882cf99',
  sha1: '5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8',
  sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  sha512:
    'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86',
  // NT hash (MD4 of UTF-16LE) of "password".
  ntlm: '8846f7eaee8fb117ad06bdd830b7586c',
};

describe('hashing', () => {
  it('matches known digests for every algorithm', () => {
    const all = hashAll(PASSWORD);
    expect(all.md5).toBe(VECTORS.md5);
    expect(all.sha1).toBe(VECTORS.sha1);
    expect(all.sha256).toBe(VECTORS.sha256);
    expect(all.sha512).toBe(VECTORS.sha512);
    expect(all.ntlm).toBe(VECTORS.ntlm);
  });

  it('hashWith agrees with hashAll', () => {
    expect(hashWith('sha256', PASSWORD)).toBe(VECTORS.sha256);
    expect(hashWith('ntlm', PASSWORD)).toBe(VECTORS.ntlm);
  });

  it('encodes UTF-16LE for NTLM (2 bytes per ASCII char, low byte first)', () => {
    expect(utf16leBytes('AB')).toEqual([0x41, 0x00, 0x42, 0x00]);
  });

  it('produces lowercase hex output', () => {
    const all = hashAll('MixedCase');
    for (const v of Object.values(all)) {
      expect(v).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('NTLM of empty string is the known constant', () => {
    expect(ntlm('')).toBe('31d6cfe0d16ae931b73c59d7e0c089c0');
  });
});
