import { useState, type FormEvent } from 'react';
import type { JoinResult } from '@snake-arena/shared';
import type { Session } from '../App';
import { socket } from '../socket';

const NAME_KEY = 'snake-arena:name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* stockage indisponible : pas grave */
  }
}

interface Props {
  connected: boolean;
  onJoined: (session: Session) => void;
}

export function Lobby({ connected, onJoined }: Props) {
  const [name, setName] = useState(loadName);
  // Un lien partagé du type ?room=ABCD pré-remplit le code
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handle = (result: JoinResult) => {
    setPending(false);
    if (!result.ok) return setError(result.error);
    window.history.replaceState(null, '', `?room=${result.code}`);
    onJoined({ code: result.code, playerId: result.playerId });
  };

  const submit = (mode: 'create' | 'join') => (event?: FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) return setError('Choisis un pseudo');
    setError(null);
    setPending(true);
    saveName(name.trim());
    if (mode === 'create') socket.emit('room:create', { name }, handle);
    else socket.emit('room:join', { code, name }, handle);
  };

  const disabled = !connected || pending;

  return (
    <section className="lobby">
      <p className="tagline">Jusqu'à 8 joueurs. Mange, grandis, ne percute personne.</p>

      <label className="field">
        <span>Pseudo</span>
        <input
          value={name}
          maxLength={16}
          placeholder="Ton pseudo"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <button className="btn primary" disabled={disabled} onClick={() => submit('create')()}>
        Créer un salon
      </button>

      <div className="divider">ou rejoindre</div>

      <form className="join" onSubmit={submit('join')}>
        <input
          value={code}
          maxLength={4}
          placeholder="CODE"
          aria-label="Code du salon"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button className="btn" disabled={disabled || code.length !== 4}>
          Rejoindre
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
