import type { Direction, GameConfig, GameState, Point, Rng, Snake } from './types';

/**
 * Logique pure du jeu : aucune dépendance au réseau ni au rendu.
 * Chaque fonction prend un état et renvoie un nouvel état (pas de mutation),
 * ce qui la rend simple à tester et réutilisable côté serveur comme côté client.
 */

export const DEFAULT_CONFIG: GameConfig = { width: 40, height: 28, foodCount: 6 };
export const INITIAL_LENGTH = 3;
export const TICK_MS = 100;

export const SNAKE_COLORS = [
  '#4ade80', '#60a5fa', '#f472b6', '#facc15',
  '#a78bfa', '#fb923c', '#2dd4bf', '#f87171',
];

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const DIRECTIONS = Object.keys(VECTORS) as Direction[];

export const keyOf = (p: Point): string => `${p.x},${p.y}`;

const inBounds = (p: Point, config: GameConfig): boolean =>
  p.x >= 0 && p.y >= 0 && p.x < config.width && p.y < config.height;

function occupiedCells(state: GameState): Set<string> {
  const cells = new Set<string>();
  for (const snake of Object.values(state.snakes)) {
    for (const part of snake.body) cells.add(keyOf(part));
  }
  for (const f of state.food) cells.add(keyOf(f));
  return cells;
}

function freeCells(state: GameState): Point[] {
  const taken = occupiedCells(state);
  const cells: Point[] = [];
  for (let y = 0; y < state.config.height; y++) {
    for (let x = 0; x < state.config.width; x++) {
      if (!taken.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}

export function fillFood(state: GameState, rng: Rng): GameState {
  const missing = state.config.foodCount - state.food.length;
  if (missing <= 0) return state;

  const candidates = freeCells(state);
  const food = [...state.food];
  for (let i = 0; i < missing && candidates.length > 0; i++) {
    const index = Math.floor(rng() * candidates.length);
    food.push(candidates.splice(index, 1)[0]!);
  }
  return { ...state, food };
}

export function createGame(config: GameConfig = DEFAULT_CONFIG, rng: Rng = Math.random): GameState {
  return fillFood({ config, tick: 0, snakes: {}, food: [] }, rng);
}

/**
 * Cherche une position où le serpent tient à l'horizontale, orienté vers la droite,
 * avec deux cases libres devant lui pour ne pas mourir instantanément.
 */
function findSpawn(state: GameState, rng: Rng): Point[] | null {
  const taken = occupiedCells(state);
  const { width, height } = state.config;
  const total = width * height;
  const start = Math.floor(rng() * total);

  for (let i = 0; i < total; i++) {
    const cell = (start + i) % total;
    const head = { x: cell % width, y: Math.floor(cell / width) };
    const body = Array.from({ length: INITIAL_LENGTH }, (_, k) => ({ x: head.x - k, y: head.y }));
    const ahead = [1, 2].map((k) => ({ x: head.x + k, y: head.y }));
    const fits = [...body, ...ahead].every((p) => inBounds(p, state.config) && !taken.has(keyOf(p)));
    if (fits) return body;
  }
  return null;
}

export function addPlayer(state: GameState, id: string, name: string, rng: Rng = Math.random): GameState {
  const existing = state.snakes[id];
  const body = findSpawn(state, rng);
  if (!body) throw new Error('Plus de place sur la carte');

  const color =
    existing?.color ?? SNAKE_COLORS[Object.keys(state.snakes).length % SNAKE_COLORS.length]!;

  const snake: Snake = {
    id,
    name: existing?.name ?? name,
    color,
    body,
    direction: 'right',
    nextDirection: 'right',
    alive: true,
    score: 0,
  };
  return { ...state, snakes: { ...state.snakes, [id]: snake } };
}

export function respawn(state: GameState, id: string, rng: Rng = Math.random): GameState {
  const snake = state.snakes[id];
  if (!snake || snake.alive) return state;
  return addPlayer(state, id, snake.name, rng);
}

export function removePlayer(state: GameState, id: string): GameState {
  if (!state.snakes[id]) return state;
  const { [id]: _removed, ...snakes } = state.snakes;
  return { ...state, snakes };
}

export function changeDirection(state: GameState, id: string, direction: Direction): GameState {
  const snake = state.snakes[id];
  if (!snake || !snake.alive) return state;
  // Interdit le demi-tour (on compare à la direction réellement appliquée au dernier tick)
  if (OPPOSITE[snake.direction] === direction) return state;
  return { ...state, snakes: { ...state.snakes, [id]: { ...snake, nextDirection: direction } } };
}

/** Avance la partie d'un tick : déplacement, nourriture, collisions. */
export function step(state: GameState, rng: Rng = Math.random): GameState {
  const foodKeys = new Set(state.food.map(keyOf));
  const eaten = new Set<string>();
  const snakes: Record<string, Snake> = { ...state.snakes };

  // 1. Tous les serpents vivants avancent simultanément
  for (const snake of Object.values(state.snakes)) {
    if (!snake.alive) continue;
    const head = snake.body[0]!;
    const v = VECTORS[snake.nextDirection];
    const newHead = { x: head.x + v.x, y: head.y + v.y };
    const ate = foodKeys.has(keyOf(newHead));
    if (ate) eaten.add(keyOf(newHead));

    snakes[snake.id] = {
      ...snake,
      direction: snake.nextDirection,
      body: ate ? [newHead, ...snake.body] : [newHead, ...snake.body.slice(0, -1)],
      score: snake.score + (ate ? 1 : 0),
    };
  }

  // 2. Collisions : une case occupée plus d'une fois là où se trouve une tête = mort
  //    (couvre le corps d'un autre, son propre corps et les têtes qui se percutent)
  const counts = new Map<string, number>();
  for (const snake of Object.values(snakes)) {
    if (!snake.alive) continue;
    for (const part of snake.body) {
      const k = keyOf(part);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  for (const snake of Object.values(snakes)) {
    if (!snake.alive) continue;
    const head = snake.body[0]!;
    const crashed = !inBounds(head, state.config) || (counts.get(keyOf(head)) ?? 0) > 1;
    if (crashed) snakes[snake.id] = { ...snake, alive: false, body: [] };
  }

  const next: GameState = {
    ...state,
    tick: state.tick + 1,
    snakes,
    food: state.food.filter((f) => !eaten.has(keyOf(f))),
  };
  return fillFood(next, rng);
}
