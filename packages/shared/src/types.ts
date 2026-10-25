export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  name: string;
  color: string;
  /** body[0] est la tête */
  body: Point[];
  /** Direction appliquée au dernier tick */
  direction: Direction;
  /** Direction demandée par le joueur, appliquée au prochain tick */
  nextDirection: Direction;
  alive: boolean;
  score: number;
}

export interface GameConfig {
  width: number;
  height: number;
  foodCount: number;
}

export interface GameState {
  config: GameConfig;
  tick: number;
  snakes: Record<string, Snake>;
  food: Point[];
}

/** Générateur aléatoire injectable : rend la logique déterministe en test */
export type Rng = () => number;

// ---- Protocole client <-> serveur (typé des deux côtés) ----

export type JoinResult =
  | { ok: true; code: string; playerId: string }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: (result: JoinResult) => void) => void;
  'room:join': (payload: { code: string; name: string }, ack: (result: JoinResult) => void) => void;
  input: (direction: Direction) => void;
  respawn: () => void;
}

export interface ServerToClientEvents {
  state: (state: GameState) => void;
}
