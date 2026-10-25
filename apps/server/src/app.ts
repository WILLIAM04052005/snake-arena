import Fastify from 'fastify';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
} from '@snake-arena/shared';
import { GameRoom, RoomManager } from './room';
import { createRateLimiter, parseDirection, parseName, parseRoomCode } from './validation';

interface SocketData {
  roomCode?: string;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface ServerOptions {
  corsOrigin: string | string[];
  logger?: boolean;
}

/** Construit le serveur sans le démarrer : pratique pour les tests d'intégration */
export function buildServer({ corsOrigin, logger = false }: ServerOptions) {
  const app = Fastify({ logger });
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    app.server,
    { cors: { origin: corsOrigin } },
  );

  const rooms = new RoomManager((room) => io.to(room.code).emit('state', room.state));

  app.get('/health', async () => ({ status: 'ok', rooms: rooms.size }));

  const reply = (ack: unknown, result: JoinResult) => {
    if (typeof ack === 'function') ack(result);
  };

  const leaveCurrentRoom = (socket: GameSocket) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    socket.leave(code);
    socket.data.roomCode = undefined;
    if (room) {
      room.leave(socket.id);
      rooms.release(room);
    }
  };

  const enterRoom = (socket: GameSocket, room: GameRoom, name: string, ack: unknown) => {
    try {
      room.join(socket.id, name);
    } catch {
      rooms.release(room);
      return reply(ack, { ok: false, error: 'Plus de place sur la carte' });
    }
    socket.join(room.code);
    socket.data.roomCode = room.code;
    reply(ack, { ok: true, code: room.code, playerId: socket.id });
    socket.emit('state', room.state);
  };

  io.on('connection', (socket: GameSocket) => {
    const allowInput = createRateLimiter(20, 1000);

    socket.on('room:create', (payload, ack) => {
      const name = parseName(payload?.name);
      if (!name) return reply(ack, { ok: false, error: 'Pseudo invalide (1 à 16 caractères)' });
      leaveCurrentRoom(socket);
      enterRoom(socket, rooms.create(), name, ack);
    });

    socket.on('room:join', (payload, ack) => {
      const name = parseName(payload?.name);
      if (!name) return reply(ack, { ok: false, error: 'Pseudo invalide (1 à 16 caractères)' });
      const code = parseRoomCode(payload?.code);
      const room = code ? rooms.get(code) : undefined;
      if (!room) return reply(ack, { ok: false, error: 'Salon introuvable' });
      if (room.isFull) return reply(ack, { ok: false, error: 'Salon complet' });
      leaveCurrentRoom(socket);
      enterRoom(socket, room, name, ack);
    });

    socket.on('input', (value) => {
      if (!allowInput()) return;
      const direction = parseDirection(value);
      const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
      if (direction && room) room.input(socket.id, direction);
    });

    socket.on('respawn', () => {
      const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
      room?.respawn(socket.id);
    });

    socket.on('disconnect', () => leaveCurrentRoom(socket));
  });

  return { app, io, rooms };
}
