import { describe, it, expect } from 'vitest';
import { emailVariants, plaintextVariants, variantsFor } from './normalize';

function values(variants: { value: string }[]) {
  return variants.map((v) => v.value);
}

describe('normalize', () => {
  it('produces Gmail dot + plus variants', () => {
    const vs = emailVariants('Alice.Smith+promo@Gmail.com');
    const vals = values(vs);
    expect(vals).toContain('alice.smith+promo@gmail.com'); // lowercase + trimmed
    expect(vals).toContain('alicesmith+promo@gmail.com'); // dot-normalized
    expect(vals).toContain('alice.smith@gmail.com'); // plus stripped
    expect(vals).toContain('alicesmith@gmail.com'); // dot + plus
  });

  it('does not apply Gmail rules to other providers', () => {
    const vs = emailVariants('a.b+tag@outlook.com');
    const vals = values(vs);
    expect(vals).not.toContain('ab@outlook.com');
    expect(vals).toContain('a.b+tag@outlook.com');
  });

  it('dedupes identical variants', () => {
    const vs = emailVariants('plain@example.com');
    const vals = values(vs);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it('preserves case for plaintext but adds a trimmed form', () => {
    const vs = plaintextVariants('  Secret  ');
    const vals = values(vs);
    expect(vals).toContain('  Secret  ');
    expect(vals).toContain('Secret');
    expect(vals).not.toContain('secret');
  });

  it('variantsFor routes by email flag', () => {
    // Mixed-case email yields at least original + lowercased variants.
    expect(variantsFor('Foo@Bar.com', true).length).toBeGreaterThan(1);
    expect(variantsFor('hunter2', false)[0].value).toBe('hunter2');
  });
});
