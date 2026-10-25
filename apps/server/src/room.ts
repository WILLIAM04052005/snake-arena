import {
  DEFAULT_CONFIG,
  TICK_MS,
  addPlayer,
  changeDirection,
  createGame,
  removePlayer,
  respawn,
  step,
  type Direction,
  type GameState,
} from '@snake-arena/shared';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './validation';

export const MAX_PLAYERS_PER_ROOM = 8;

/**
 * Un salon = une partie. Le serveur fait autorité : il est le seul à faire
 * avancer l'état du jeu, les clients ne font qu'envoyer des intentions.
 */
export class GameRoom {
  state: GameState;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly code: string,
    private readonly onTick: (room: GameRoom) => void,
  ) {
    this.state = createGame(DEFAULT_CONFIG);
  }

  get playerCount(): number {
    return Object.keys(this.state.snakes).length;
  }

  get isFull(): boolean {
    return this.playerCount >= MAX_PLAYERS_PER_ROOM;
  }

  join(playerId: string, name: string): void {
    this.state = addPlayer(this.state, playerId, name);
    this.start();
  }

  leave(playerId: string): void {
    this.state = removePlayer(this.state, playerId);
    if (this.playerCount === 0) this.stop();
  }

  input(playerId: string, direction: Direction): void {
    this.state = changeDirection(this.state, playerId, direction);
  }

  respawn(playerId: string): void {
    this.state = respawn(this.state, playerId);
  }

  tick(): void {
    this.state = step(this.state);
    this.onTick(this);
  }

  start(): void {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  constructor(
    private readonly onTick: (room: GameRoom) => void,
    private readonly random: () => number = Math.random,
  ) {}

  create(): GameRoom {
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));

    const room = new GameRoom(code, this.onTick);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code);
  }

  /** Supprime le salon s'il est vide */
  release(room: GameRoom): void {
    if (room.playerCount === 0) {
      room.stop();
      this.rooms.delete(room.code);
    }
  }

  get size(): number {
    return this.rooms.size;
  }
}
