import { describe, expect, it } from 'vitest';

import { ariary } from './libelles-evaluation';

describe('ariary', () => {
  const norm = (s: string): string => s.replace(/\s/g, ' ');

  it('un entier sans décimales ; rien : un tiret', () => {
    expect(norm(ariary(31475929))).toBe('31 475 929 Ar');
    expect(ariary(null)).toBe('—');
  });

  it('29/10 (recette des formes) — un montant au centime garde ses deux décimales', () => {
    expect(norm(ariary(37771114.8))).toBe('37 771 114,80 Ar');
    expect(norm(ariary(0.5))).toBe('0,50 Ar');
  });
});
