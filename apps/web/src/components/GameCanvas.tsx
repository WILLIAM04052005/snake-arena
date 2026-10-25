import { useEffect, useRef } from 'react';
import type { GameState } from '@snake-arena/shared';

const CELL = 18;

interface Props {
  state: GameState;
  playerId: string;
}

/** Rendu Canvas : redessine toute la grille à chaque nouvel état reçu */
export function GameCanvas({ state, playerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = state.config;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Net sur les écrans haute densité
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * CELL * dpr;
    canvas.height = height * CELL * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, width * CELL, height * CELL);

    // Grille en pointillés discrets
    ctx.fillStyle = '#1a222c';
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
      }
    }

    // Nourriture
    for (const f of state.food) {
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Serpents
    for (const snake of Object.values(state.snakes)) {
      if (!snake.alive) continue;
      const isMe = snake.id === playerId;
      snake.body.forEach((part, i) => {
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.03);
        ctx.fillStyle = snake.color;
        if (isMe && i === 0) {
          ctx.shadowColor = snake.color;
          ctx.shadowBlur = 14;
        }
        ctx.fillRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2);
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1;

      // Pseudo au-dessus de la tête
      const head = snake.body[0];
      if (head) {
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isMe ? '#ffffff' : '#94a3b8';
        ctx.fillText(snake.name, head.x * CELL + CELL / 2, head.y * CELL - 4);
      }
    }
  }, [state, playerId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="board"
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-label="Plateau de jeu"
    />
  );
}
