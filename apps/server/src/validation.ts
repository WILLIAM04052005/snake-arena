import { DIRECTIONS, type Direction } from '@snake-arena/shared';

/**
 * Le serveur ne fait jamais confiance au client : tout ce qui arrive
 * par le réseau est validé avant d'être utilisé.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O (confusion avec 1 et 0)
export const ROOM_CODE_LENGTH = 4;
export const NAME_MAX_LENGTH = 16;

export function parseName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > NAME_MAX_LENGTH) return null;
  return name;
}

export function parseRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  const pattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
  return pattern.test(code) ? code : null;
}

export function parseDirection(value: unknown): Direction | null {
  return DIRECTIONS.includes(value as Direction) ? (value as Direction) : null;
}

/**
 * Limiteur simple à fenêtre fixe : au-delà de `max` messages par `windowMs`,
 * les messages sont ignorés. Évite qu'un client inonde le serveur.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  let windowStart = now();
  let count = 0;
  return (): boolean => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      count = 0;
    }
    count++;
    return count <= max;
  };
}
