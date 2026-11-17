import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  MAPS_BY_ID,
  getDefaultSpawnForTeam,
  getTotalRoundsForMode,
  groundHeightAt,
} from './src/game/maps.ts';
import type {
  GameMode,
  MapId,
  OnlinePlayerSummary,
  OnlineRoomSnapshot,
  OnlineRoomSummary,
  WeaponId,
} from './src/game/types.ts';
import { WEAPONS_BY_ID } from './src/game/weapons.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_HP = 200;
const SPAWN_SHIELD_MS = 2500;

interface ServerPlayer extends OnlinePlayerSummary {
  ws: WebSocket;
  preferredSpawnId: string;
  bundleColor: 'gold' | 'ally' | 'enemy' | 'shadow';
}

interface ServerRoom {
  code: string;
  hostId: string;
  mode: GameMode;
  mapId: MapId;
  phase: 'lobby' | 'playing' | 'ended';
  round: number;
  totalRounds: number;
  allyRoundWins: number;
  enemyRoundWins: number;
  roundTransitioning: boolean;
  roundTimer: NodeJS.Timeout | null;
  players: Map<string, ServerPlayer>;
}

const rooms = new Map<string, ServerRoom>();
const clientToRoom = new Map<string, string>();
const clientSockets = new Map<string, WebSocket>();
let playerSeq = 1;

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? randomRoomCode() : code;
}

function getMaxPlayersForMode(mode: GameMode): number {
  if (mode === 'lone_wolf_1v1') return 2;
  if (mode === 'cs_4v4') return 8;
  return 50;
}

function toRoomSummary(room: ServerRoom): OnlineRoomSummary {
  const host = room.players.get(room.hostId);
  return {
    code: room.code,
    mode: room.mode,
    mapId: room.mapId,
    phase: room.phase,
    round: room.round,
    totalRounds: room.totalRounds,
    playerCount: room.players.size,
    maxPlayers: getMaxPlayersForMode(room.mode),
    hostName: host?.name ?? 'Host',
  };
}

function toPlayerSummary(p: ServerPlayer): OnlinePlayerSummary {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    weapon: p.weapon,
    hp: p.hp,
    maxHp: p.maxHp,
    kills: p.kills,
    deaths: p.deaths,
    alive: p.alive,
    spawnProtectionUntil: p.spawnProtectionUntil,
    isAiming: p.isAiming,
  };
}

function toRoomSnapshot(room: ServerRoom): OnlineRoomSnapshot {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    mapId: room.mapId,
    phase: room.phase,
    round: room.round,
    totalRounds: room.totalRounds,
    allyRoundWins: room.allyRoundWins,
    enemyRoundWins: room.enemyRoundWins,
    players: Array.from(room.players.values()).map(toPlayerSummary),
  };
}

function sendJson(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastRoom(room: ServerRoom, type: string, payload: unknown, excludeId?: string) {
  const msg = JSON.stringify({ type, payload });
  for (const [pid, player] of room.players) {
    if (excludeId && pid === excludeId) continue;
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msg);
    }
  }
}

function broadcastRoomList() {
  const summaries = Array.from(rooms.values()).map(toRoomSummary);
  const msg = JSON.stringify({ type: 'room:list', payload: summaries });
  for (const ws of clientSockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function assignTeamsAndSpawns(room: ServerRoom) {
  const playerList = Array.from(room.players.values());
  const now = Date.now();
  let allyCount = 0;
  let enemyCount = 0;

  playerList.forEach((p, idx) => {
    // Host / first player on 'ally', alternate balanced teams in 4v4 / 1v1, or free-for-all enemy opposition in BR
    const team: 'ally' | 'enemy' =
      room.mode === 'br_1v50'
        ? idx === 0
          ? 'ally'
          : 'enemy'
        : idx % 2 === 0
          ? 'ally'
          : 'enemy';

    p.team = team;
    const teamIdx = team === 'ally' ? allyCount++ : enemyCount++;
    const spawn = getDefaultSpawnForTeam(
      room.mapId,
      team,
      team === 'ally' ? p.preferredSpawnId : undefined
    );
    const offset = (teamIdx % 4) * 2.4 - (teamIdx > 0 ? 1.2 : 0);
    const sx = spawn.x + offset;
    const sz = spawn.z + (teamIdx >= 2 ? 1.8 : 0);

    p.x = sx;
    p.y = groundHeightAt(sx, sz, room.mapId);
    p.z = sz;
    p.yaw = spawn.yaw;
    p.pitch = 0.12;
    p.hp = MAX_HP;
    p.maxHp = MAX_HP;
    p.alive = true;
    p.spawnProtectionUntil = now + SPAWN_SHIELD_MS;
  });
}

function startRound(room: ServerRoom, roundNumber: number) {
  room.round = roundNumber;
  room.roundTransitioning = false;
  assignTeamsAndSpawns(room);
  const snapshot = toRoomSnapshot(room);
  broadcastRoom(room, 'round:started', snapshot);
  broadcastRoom(room, 'room:state', snapshot);
}

function evaluateRoundOrMatchEnd(room: ServerRoom) {
  if (room.phase !== 'playing' || room.roundTransitioning) return;

  const list = Array.from(room.players.values());
  if (list.length < 2) return;

  if (room.mode === 'br_1v50') {
    // BR 1v50 has NO rounds; match ends only when 1 survivor remains
    const alivePlayers = list.filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      room.phase = 'ended';
      const winner = alivePlayers[0] ?? list[0];
      broadcastRoom(room, 'match:ended', {
        winnerTeam: winner?.team ?? 'ally',
        winnerId: winner?.id ?? null,
        snapshot: toRoomSnapshot(room),
      });
      broadcastRoomList();
    }
    return;
  }

  // CS 4v4 and Lone Wolf 1v1 use a 4-round system (plus Sudden Death OT if tied 2-2)
  const alliesAlive = list.filter((p) => p.team === 'ally' && p.alive).length;
  const enemiesAlive = list.filter((p) => p.team === 'enemy' && p.alive).length;
  const totalAllies = list.filter((p) => p.team === 'ally').length;
  const totalEnemies = list.filter((p) => p.team === 'enemy').length;

  if (totalAllies === 0 || totalEnemies === 0) return;

  let roundWinner: 'ally' | 'enemy' | null = null;
  if (enemiesAlive === 0 && alliesAlive > 0) roundWinner = 'ally';
  else if (alliesAlive === 0 && enemiesAlive > 0) roundWinner = 'enemy';

  if (!roundWinner) return;

  if (roundWinner === 'ally') room.allyRoundWins += 1;
  else room.enemyRoundWins += 1;

  const isTiebreakerNeeded =
    room.round === 4 && room.allyRoundWins === 2 && room.enemyRoundWins === 2;
  const matchFinished =
    (room.round >= room.totalRounds && !isTiebreakerNeeded) ||
    room.allyRoundWins >= 3 ||
    room.enemyRoundWins >= 3;

  room.roundTransitioning = true;
  broadcastRoom(room, 'round:ended', {
    winnerTeam: roundWinner,
    round: room.round,
    totalRounds: room.totalRounds,
    allyRoundWins: room.allyRoundWins,
    enemyRoundWins: room.enemyRoundWins,
    matchFinished,
  });

  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (matchFinished) {
      room.phase = 'ended';
      const winnerTeam = room.allyRoundWins >= room.enemyRoundWins ? 'ally' : 'enemy';
      broadcastRoom(room, 'match:ended', {
        winnerTeam,
        winnerId: null,
        snapshot: toRoomSnapshot(room),
      });
      broadcastRoomList();
    } else {
      startRound(room, room.round + 1);
    }
  }, 2400);
}

function leaveCurrentRoom(playerId: string) {
  const code = clientToRoom.get(playerId);
  if (!code) return;
  clientToRoom.delete(playerId);
  const room = rooms.get(code);
  if (!room) return;

  room.players.delete(playerId);
  if (room.players.size === 0) {
    if (room.roundTimer) clearTimeout(room.roundTimer);
    rooms.delete(code);
    broadcastRoomList();
    return;
  }

  if (room.hostId === playerId) {
    const nextHost = room.players.values().next().value;
    if (nextHost) room.hostId = nextHost.id;
  }

  broadcastRoom(room, 'room:state', toRoomSnapshot(room));
  broadcastRoomList();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, players: clientSockets.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: Array.from(rooms.values()).map(toRoomSummary) });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const playerId = `p_${playerSeq++}_${Math.random().toString(36).slice(2, 6)}`;
    clientSockets.set(playerId, ws);

    sendJson(ws, 'session:welcome', {
      playerId,
      rooms: Array.from(rooms.values()).map(toRoomSummary),
    });

    ws.on('message', (raw) => {
      let msg: { type?: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = msg.type;
      const payload = msg.payload ?? {};

      if (type === 'room:list') {
        sendJson(ws, 'room:list', Array.from(rooms.values()).map(toRoomSummary));
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom(playerId);
        return;
      }

      if (type === 'room:create' || type === 'room:quick_match') {
        const name = String(payload.name || `Kelly_${playerId.slice(-3)}`).slice(0, 18);
        const mode = (payload.mode as GameMode) || 'cs_4v4';
        const mapId = (payload.mapId as MapId) || 'london';
        const spawnId = String(payload.spawnId || MAPS_BY_ID[mapId].spawns[0].id);
        const bundleColor =
          (payload.bundleColor as ServerPlayer['bundleColor']) || 'gold';

        let targetRoom: ServerRoom | undefined;
        if (type === 'room:quick_match') {
          targetRoom = Array.from(rooms.values()).find(
            (r) =>
              r.mode === mode &&
              r.mapId === mapId &&
              r.phase === 'lobby' &&
              r.players.size < getMaxPlayersForMode(r.mode)
          );
        }

        if (!targetRoom) {
          const code = randomRoomCode();
          targetRoom = {
            code,
            hostId: playerId,
            mode,
            mapId,
            phase: 'lobby',
            round: getTotalRoundsForMode(mode) > 0 ? 1 : 0,
            totalRounds: getTotalRoundsForMode(mode),
            allyRoundWins: 0,
            enemyRoundWins: 0,
            roundTransitioning: false,
            roundTimer: null,
            players: new Map(),
          };
          rooms.set(code, targetRoom);
        }

        leaveCurrentRoom(playerId);
        const team: 'ally' | 'enemy' =
          targetRoom.players.size % 2 === 0 ? 'ally' : 'enemy';
        const spawn = getDefaultSpawnForTeam(targetRoom.mapId, team, spawnId);

        targetRoom.players.set(playerId, {
          id: playerId,
          name,
          team,
          x: spawn.x,
          y: groundHeightAt(spawn.x, spawn.z, targetRoom.mapId),
          z: spawn.z,
          yaw: spawn.yaw,
          pitch: 0.14,
          weapon: 'm1887',
          hp: MAX_HP,
          maxHp: MAX_HP,
          kills: 0,
          deaths: 0,
          alive: true,
          spawnProtectionUntil: 0,
          isAiming: false,
          ws,
          preferredSpawnId: spawnId,
          bundleColor,
        });
        clientToRoom.set(playerId, targetRoom.code);

        const snapshot = toRoomSnapshot(targetRoom);
        broadcastRoom(targetRoom, 'room:state', snapshot);
        broadcastRoomList();
        return;
      }

      if (type === 'room:join') {
        const code = String(payload.code || '')
          .trim()
          .toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, 'error', { message: `Room ${code} was not found.` });
          return;
        }
        if (room.players.size >= getMaxPlayersForMode(room.mode)) {
          sendJson(ws, 'error', { message: `Room ${code} is full.` });
          return;
        }

        const name = String(payload.name || `Kelly_${playerId.slice(-3)}`).slice(0, 18);
        const spawnId = String(payload.spawnId || MAPS_BY_ID[room.mapId].spawns[0].id);
        const bundleColor =
          (payload.bundleColor as ServerPlayer['bundleColor']) || 'gold';

        leaveCurrentRoom(playerId);
        const team: 'ally' | 'enemy' = room.players.size % 2 === 0 ? 'ally' : 'enemy';
        const spawn = getDefaultSpawnForTeam(room.mapId, team, spawnId);

        room.players.set(playerId, {
          id: playerId,
          name,
          team,
          x: spawn.x,
          y: groundHeightAt(spawn.x, spawn.z, room.mapId),
          z: spawn.z,
          yaw: spawn.yaw,
          pitch: 0.14,
          weapon: 'm1887',
          hp: MAX_HP,
          maxHp: MAX_HP,
          kills: 0,
          deaths: 0,
          alive: true,
          spawnProtectionUntil: Date.now() + SPAWN_SHIELD_MS,
          isAiming: false,
          ws,
          preferredSpawnId: spawnId,
          bundleColor,
        });
        clientToRoom.set(playerId, room.code);

        const snapshot = toRoomSnapshot(room);
        broadcastRoom(room, 'room:state', snapshot);
        if (room.phase === 'playing') {
          sendJson(ws, 'match:started', snapshot);
        }
        broadcastRoomList();
        return;
      }

      const code = clientToRoom.get(playerId);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      if (type === 'room:update_config') {
        if (payload.spawnId) {
          player.preferredSpawnId = String(payload.spawnId);
        }
        if (room.hostId === playerId && room.phase === 'lobby') {
          if (payload.mode) {
            room.mode = payload.mode as GameMode;
            room.totalRounds = getTotalRoundsForMode(room.mode);
            room.round = room.totalRounds > 0 ? 1 : 0;
          }
          if (payload.mapId) {
            room.mapId = payload.mapId as MapId;
          }
        }
        broadcastRoom(room, 'room:state', toRoomSnapshot(room));
        broadcastRoomList();
        return;
      }

      if (type === 'room:start') {
        if (room.hostId !== playerId) return;
        room.phase = 'playing';
        room.allyRoundWins = 0;
        room.enemyRoundWins = 0;
        room.totalRounds = getTotalRoundsForMode(room.mode);
        room.round = room.totalRounds > 0 ? 1 : 0;
        for (const p of room.players.values()) {
          p.kills = 0;
          p.deaths = 0;
        }
        assignTeamsAndSpawns(room);
        const snapshot = toRoomSnapshot(room);
        broadcastRoom(room, 'match:started', snapshot);
        broadcastRoom(room, 'room:state', snapshot);
        broadcastRoomList();
        return;
      }

      if (type === 'player:state') {
        if (room.phase !== 'playing' || !player.alive) return;
        player.x = Number(payload.x) || player.x;
        player.y = Number(payload.y) || player.y;
        player.z = Number(payload.z) || player.z;
        player.yaw = Number(payload.yaw) || 0;
        player.pitch = Number(payload.pitch) || 0;
        player.weapon = (payload.weapon as WeaponId) || player.weapon;
        player.isAiming = Boolean(payload.isAiming);
        return;
      }

      if (type === 'player:respawn') {
        if (room.phase !== 'playing') return;
        // Allowed in BR (no rounds) or when choosing a new tactical drop pad
        if (room.totalRounds > 0 && !player.alive) return;

        const spawnId = String(payload.spawnId || player.preferredSpawnId);
        player.preferredSpawnId = spawnId;
        const spawn = getDefaultSpawnForTeam(room.mapId, player.team, spawnId);
        player.x = spawn.x;
        player.y = groundHeightAt(spawn.x, spawn.z, room.mapId);
        player.z = spawn.z;
        player.yaw = spawn.yaw;
        player.hp = MAX_HP;
        player.alive = true;
        player.spawnProtectionUntil = Date.now() + SPAWN_SHIELD_MS;

        broadcastRoom(room, 'room:state', toRoomSnapshot(room));
        return;
      }

      if (type === 'player:shoot') {
        if (room.phase !== 'playing' || !player.alive) return;
        const weaponId = (payload.weapon as WeaponId) || player.weapon;
        const spec = WEAPONS_BY_ID[weaponId];
        if (!spec) return;

        broadcastRoom(
          room,
          'world:shot',
          {
            shooterId: playerId,
            weapon: weaponId,
            origin: payload.origin,
            dir: payload.dir,
            tracerColor: spec.tracerColor,
            tracerSpeed: spec.tracerSpeed,
            isExplosive: Boolean(spec.isExplosive),
          },
          playerId
        );

        const targetId = payload.hitPlayerId ? String(payload.hitPlayerId) : null;
        if (!targetId) return;
        const victim = room.players.get(targetId);
        if (!victim || !victim.alive || victim.id === player.id) return;
        if (room.mode === 'cs_4v4' && victim.team === player.team) return;

        const now = Date.now();
        if (now < victim.spawnProtectionUntil) {
          sendJson(ws, 'player:spawn_protected', { targetId: victim.id });
          return;
        }

        const isHeadshot = Boolean(payload.isHeadshot);
        const dmg = isHeadshot ? spec.headDamage : spec.bodyDamage;
        victim.hp = Math.max(0, victim.hp - dmg);

        broadcastRoom(room, 'player:damaged', {
          attackerId: player.id,
          targetId: victim.id,
          damage: dmg,
          hp: victim.hp,
          isHeadshot,
        });

        if (victim.hp <= 0) {
          victim.alive = false;
          victim.deaths += 1;
          player.kills += 1;

          broadcastRoom(room, 'player:killed', {
            killerId: player.id,
            killerName: player.name,
            victimId: victim.id,
            victimName: victim.name,
            weaponName: spec.name,
            isHeadshot,
            canRespawn: room.mode === 'br_1v50',
          });

          evaluateRoundOrMatchEnd(room);
        }
      }
    });

    ws.on('close', () => {
      clientSockets.delete(playerId);
      leaveCurrentRoom(playerId);
    });
  });

  // Broadcast world snapshots at 20Hz for smooth multiplayer motion
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.phase !== 'playing' || room.players.size === 0) continue;
      broadcastRoom(room, 'world:snapshot', toRoomSnapshot(room));
    }
  }, 50);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Gojo Battlegrounds online & arena server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
