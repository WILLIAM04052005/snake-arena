import { useEffect, useRef, useState } from 'react';
import type { Direction, GameState } from '@snake-arena/shared';
import type { Session } from '../App';
import { socket } from '../socket';
import { GameCanvas } from './GameCanvas';

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  z: 'up', s: 'down', q: 'left', d: 'right', // AZERTY
  w: 'up', a: 'left', // QWERTY
};

interface Props {
  session: Session;
  onLeave: () => void;
}

export function Game({ session, onLeave }: Props) {
  const [state, setState] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const me = state?.snakes[session.playerId];
  const isDead = me ? !me.alive : false;

  useEffect(() => {
    socket.on('state', setState);
    return () => {
      socket.off('state', setState);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const direction = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (direction) {
        e.preventDefault();
        socket.emit('input', direction);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        socket.emit('respawn');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Glisser du doigt sur mobile
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    socket.emit('input', Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${session.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers refusé */
    }
  };

  const ranking = state
    ? Object.values(state.snakes).sort((a, b) => b.score - a.score)
    : [];

  return (
    <section className="game">
      <div className="board-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {state ? <GameCanvas state={state} playerId={session.playerId} /> : <p>Chargement…</p>}
        {isDead && (
          <div className="overlay">
            <p className="overlay-title">PERDU</p>
            <button className="btn primary" onClick={() => socket.emit('respawn')}>
              Rejouer
            </button>
            <p className="hint">ou appuie sur Espace</p>
          </div>
        )}
      </div>

      <aside className="sidebar">
        <div className="room">
          <span className="label">Salon</span>
          <span className="code">{session.code}</span>
          <button className="btn small" onClick={copyLink}>
            {copied ? 'Lien copié ✓' : 'Copier le lien'}
          </button>
        </div>

        <ol className="ranking">
          {ranking.map((s) => (
            <li key={s.id} className={s.id === session.playerId ? 'me' : ''}>
              <span className="dot" style={{ background: s.color }} />
              <span className="name">{s.name}</span>
              <span className="score">{s.alive ? s.score : '☠'}</span>
            </li>
          ))}
        </ol>

        <p className="hint">Flèches, ZQSD ou WASD · glisser sur mobile</p>
        <button className="btn ghost" onClick={onLeave}>
          Quitter
        </button>
      </aside>
    </section>
  );
}
