import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  GameState,
  JoinResult,
  ServerToClientEvents,
} from '@snake-arena/shared';
import { buildServer } from './app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Tests d'intégration : un vrai serveur, de vrais clients Socket.io */
describe('serveur de jeu', () => {
  const { app, io } = buildServer({ corsOrigin: '*' });
  let url = '';
  const clients: Client[] = [];

  const client = async (): Promise<Client> => {
    const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await new Promise<void>((resolve) => socket.on('connect', resolve));
    return socket;
  };

  const nextState = (socket: Client) =>
    new Promise<GameState>((resolve) => socket.once('state', resolve));

  beforeAll(async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    clients.forEach((c) => c.disconnect());
    io.close();
    await app.close();
  });

  it('répond au health check', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it("crée un salon puis un 2e joueur le rejoint avec le code", async () => {
    const alice = await client();
    const created = await alice.emitWithAck('room:create', { name: 'Alice' });
    expect(created.ok).toBe(true);
    const { code } = created as Extract<JoinResult, { ok: true }>;

    const bob = await client();
    const joined = await bob.emitWithAck('room:join', { code, name: 'Bob' });
    expect(joined).toMatchObject({ ok: true, code });

    const state = await nextState(alice);
    const names = Object.values(state.snakes).map((s) => s.name).sort();
    expect(names).toEqual(['Alice', 'Bob']);
  });

  it('fait avancer la partie à chaque tick', async () => {
    const carol = await client();
    await carol.emitWithAck('room:create', { name: 'Carol' });
    const a = await nextState(carol);
    const b = await nextState(carol);
    expect(b.tick).toBeGreaterThan(a.tick);
  });

  it('refuse un salon inexistant et un pseudo invalide', async () => {
    const dave = await client();
    expect(await dave.emitWithAck('room:join', { code: 'ZZZZ', name: 'Dave' })).toEqual({
      ok: false,
      error: 'Salon introuvable',
    });
    expect(await dave.emitWithAck('room:create', { name: '' })).toMatchObject({ ok: false });
  });

  it('retire le joueur quand il se déconnecte', async () => {
    const erin = await client();
    const created = (await erin.emitWithAck('room:create', { name: 'Erin' })) as Extract<
      JoinResult,
      { ok: true }
    >;
    const frank = await client();
    await frank.emitWithAck('room:join', { code: created.code, name: 'Frank' });

    erin.disconnect();
    // attend un état où Erin a disparu
    const state = await new Promise<GameState>((resolve) => {
      frank.on('state', (s) => {
        if (!Object.values(s.snakes).some((sn) => sn.name === 'Erin')) resolve(s);
      });
    });
    expect(Object.values(state.snakes).map((s) => s.name)).toEqual(['Frank']);
  });
});
