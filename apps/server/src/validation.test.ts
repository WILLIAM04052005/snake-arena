import { describe, expect, it } from 'vitest';
import { createRateLimiter, parseDirection, parseName, parseRoomCode } from './validation';

describe('parseName', () => {
  it('nettoie les espaces', () => expect(parseName('  Will   Abo ')).toBe('Will Abo'));
  it('refuse vide, trop long ou pas une chaîne', () => {
    expect(parseName('   ')).toBeNull();
    expect(parseName('x'.repeat(17))).toBeNull();
    expect(parseName(42)).toBeNull();
  });
});

describe('parseRoomCode', () => {
  it('accepte un code valide, insensible à la casse', () => expect(parseRoomCode(' abcd ')).toBe('ABCD'));
  it('refuse les codes invalides', () => {
    expect(parseRoomCode('ABC')).toBeNull();
    expect(parseRoomCode('AB1D')).toBeNull();
    expect(parseRoomCode('ABOD')).toBeNull(); // O exclu de l'alphabet
    expect(parseRoomCode(null)).toBeNull();
  });
});

describe('parseDirection', () => {
  it('accepte uniquement les 4 directions', () => {
    expect(parseDirection('up')).toBe('up');
    expect(parseDirection('diagonal')).toBeNull();
    expect(parseDirection({ x: 1 })).toBeNull();
  });
});

describe('createRateLimiter', () => {
  it('bloque au-delà du maximum puis se réinitialise', () => {
    let t = 0;
    const allow = createRateLimiter(2, 1000, () => t);
    expect([allow(), allow(), allow()]).toEqual([true, true, false]);
    t = 1000;
    expect(allow()).toBe(true);
  });
});
