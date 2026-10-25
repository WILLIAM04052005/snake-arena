import { useEffect, useState } from 'react';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { socket } from './socket';

export interface Session {
  code: string;
  playerId: string;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setSession(null); // le serveur nous a retiré du salon
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const leave = () => {
    // Se déconnecter suffit : le serveur retire le joueur du salon
    socket.disconnect();
    socket.connect();
    window.history.replaceState(null, '', window.location.pathname);
  };

  return (
    <main className="app">
      <header className="header">
        <h1 className="logo">
          SNAKE<span>ARENA</span>
        </h1>
        <span className={`status ${connected ? 'on' : 'off'}`}>
          {connected ? 'connecté' : 'connexion…'}
        </span>
      </header>

      {session ? (
        <Game session={session} onLeave={leave} />
      ) : (
        <Lobby connected={connected} onJoined={setSession} />
      )}
    </main>
  );
}
