import { describe, expect, it } from 'vitest';
import {
  INITIAL_LENGTH,
  addPlayer,
  changeDirection,
  createGame,
  keyOf,
  removePlayer,
  respawn,
  step,
} from './game';
import type { GameState, Point, Snake } from './types';

/** Générateur pseudo-aléatoire avec graine : tests reproductibles */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function snake(id: string, body: Point[], overrides: Partial<Snake> = {}): Snake {
  return {
    id,
    name: id,
    color: '#fff',
    body,
    direction: 'right',
    nextDirection: 'right',
    alive: true,
    score: 0,
    ...overrides,
  };
}

function state(snakes: Snake[], food: Point[] = [], foodCount = 0): GameState {
  return {
    config: { width: 10, height: 10, foodCount },
    tick: 0,
    snakes: Object.fromEntries(snakes.map((s) => [s.id, s])),
    food,
  };
}

describe('createGame', () => {
  it('place la nourriture dans la grille, sans doublon', () => {
    const game = createGame({ width: 20, height: 15, foodCount: 8 }, seeded(1));
    expect(game.food).toHaveLength(8);
    expect(new Set(game.food.map(keyOf)).size).toBe(8);
    for (const f of game.food) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThan(20);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThan(15);
    }
  });
});

describe('addPlayer', () => {
  it('fait apparaître un serpent vivant, de taille initiale, sur des cases libres', () => {
    const game = addPlayer(createGame(undefined, seeded(2)), 'a', 'Alice', seeded(3));
    const a = game.snakes.a!;
    expect(a.alive).toBe(true);
    expect(a.body).toHaveLength(INITIAL_LENGTH);
    const foodKeys = new Set(game.food.map(keyOf));
    expect(a.body.some((p) => foodKeys.has(keyOf(p)))).toBe(false);
  });

  it('donne des couleurs différentes aux joueurs', () => {
    let game = createGame(undefined, seeded(4));
    game = addPlayer(game, 'a', 'Alice', seeded(5));
    game = addPlayer(game, 'b', 'Bob', seeded(6));
    expect(game.snakes.a!.color).not.toBe(game.snakes.b!.color);
  });
});

describe('step', () => {
  it('avance le serpent dans sa direction en gardant sa taille', () => {
    const game = step(state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }])]));
    expect(game.snakes.a!.body).toEqual([{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }]);
    expect(game.tick).toBe(1);
  });

  it('ignore un demi-tour', () => {
    let game = state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }])]);
    game = changeDirection(game, 'a', 'left');
    game = step(game);
    expect(game.snakes.a!.body[0]).toEqual({ x: 4, y: 5 });
  });

  it('applique un changement de direction au tick suivant', () => {
    let game = state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }])]);
    game = changeDirection(game, 'a', 'up');
    game = step(game);
    expect(game.snakes.a!.body[0]).toEqual({ x: 3, y: 4 });
    expect(game.snakes.a!.direction).toBe('up');
  });

  it('fait grandir le serpent et marque un point quand il mange', () => {
    const game = step(
      state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }])], [{ x: 4, y: 5 }], 1),
      seeded(7),
    );
    const a = game.snakes.a!;
    expect(a.body).toHaveLength(4);
    expect(a.score).toBe(1);
    // la nourriture mangée est remplacée ailleurs
    expect(game.food).toHaveLength(1);
    expect(game.food[0]).not.toEqual({ x: 4, y: 5 });
  });

  it('tue le serpent qui sort de la grille', () => {
    const game = step(state([snake('a', [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }])]));
    expect(game.snakes.a!.alive).toBe(false);
    expect(game.snakes.a!.body).toEqual([]);
  });

  it('tue le serpent qui se mord la queue', () => {
    // Serpent enroulé : en tournant vers le bas, la tête rentre dans son corps
    const body = [
      { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 7 },
    ];
    let game = state([snake('a', body)]);
    game = changeDirection(game, 'a', 'down');
    game = step(game);
    expect(game.snakes.a!.alive).toBe(false);
  });

  it('autorise à avancer sur la case que la queue vient de libérer', () => {
    // Carré de 4 : la tête va là où était la queue
    const body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }];
    let game = state([snake('a', body, { direction: 'up', nextDirection: 'up' })]);
    game = changeDirection(game, 'a', 'left');
    game = step(game);
    expect(game.snakes.a!.alive).toBe(true);
  });

  it("tue le serpent qui fonce dans le corps d'un autre, l'autre survit", () => {
    const a = snake('a', [{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }], {
      direction: 'down',
      nextDirection: 'down',
    });
    const b = snake('b', [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }]);
    const game = step(state([a, b]));
    expect(game.snakes.a!.alive).toBe(false);
    expect(game.snakes.b!.alive).toBe(true);
  });

  it('tue les deux serpents en cas de collision frontale', () => {
    const a = snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }]);
    const b = snake('b', [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }], {
      direction: 'left',
      nextDirection: 'left',
    });
    const game = step(state([a, b]));
    expect(game.snakes.a!.alive).toBe(false);
    expect(game.snakes.b!.alive).toBe(false);
  });

  it("ne modifie pas l'état reçu (fonction pure)", () => {
    const before = state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }])]);
    const copy = JSON.parse(JSON.stringify(before)) as GameState;
    step(before);
    expect(before).toEqual(copy);
  });
});

describe('respawn / removePlayer', () => {
  it('fait revivre un serpent mort avec un score remis à zéro', () => {
    const dead = state([snake('a', [], { alive: false, score: 12, color: '#123456' })]);
    const game = respawn(dead, 'a', seeded(8));
    const a = game.snakes.a!;
    expect(a.alive).toBe(true);
    expect(a.score).toBe(0);
    expect(a.body).toHaveLength(INITIAL_LENGTH);
    expect(a.color).toBe('#123456');
  });

  it('ne fait rien sur un serpent vivant', () => {
    const game = state([snake('a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }], { score: 3 })]);
    expect(respawn(game, 'a')).toBe(game);
  });

  it('retire un joueur', () => {
    const game = removePlayer(state([snake('a', [{ x: 3, y: 5 }])]), 'a');
    expect(game.snakes.a).toBeUndefined();
  });
});
