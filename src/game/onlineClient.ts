import type {
  GameMode,
  MapId,
  OnlineRoomSnapshot,
  OnlineRoomSummary,
  WeaponId,
} from './types';

export type BundleSkinId = 'gold' | 'ally' | 'enemy' | 'shadow';

export interface OnlineShotEvent {
  shooterId: string;
  weapon: WeaponId;
  origin: [number, number, number];
  dir: [number, number, number];
  tracerColor: number;
  tracerSpeed: number;
  isExplosive?: boolean;
}

export interface OnlineDamageEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  hp: number;
  isHeadshot: boolean;
}

export interface OnlineKillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponName: string;
  isHeadshot: boolean;
  canRespawn: boolean;
}

export interface OnlineRoundEndEvent {
  winnerTeam: 'ally' | 'enemy';
  round: number;
  totalRounds: number;
  allyRoundWins: number;
  enemyRoundWins: number;
  matchFinished: boolean;
}

export interface OnlineMatchEndEvent {
  winnerTeam: 'ally' | 'enemy';
  winnerId: string | null;
  snapshot: OnlineRoomSnapshot;
}

export interface OnlineClientCallbacks {
  onWelcome?: (playerId: string, rooms: OnlineRoomSummary[]) => void;
  onRoomList?: (rooms: OnlineRoomSummary[]) => void;
  onRoomState?: (snapshot: OnlineRoomSnapshot) => void;
  onMatchStarted?: (snapshot: OnlineRoomSnapshot) => void;
  onWorldSnapshot?: (snapshot: OnlineRoomSnapshot) => void;
  onWorldShot?: (shot: OnlineShotEvent) => void;
  onPlayerDamaged?: (dmg: OnlineDamageEvent) => void;
  onPlayerKilled?: (kill: OnlineKillEvent) => void;
  onRoundEnded?: (ev: OnlineRoundEndEvent) => void;
  onRoundStarted?: (snapshot: OnlineRoomSnapshot) => void;
  onMatchEnded?: (ev: OnlineMatchEndEvent) => void;
  onError?: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class OnlineClient {
  private ws: WebSocket | null = null;
  private callbacks: OnlineClientCallbacks = {};
  private playerId: string | null = null;
  private connected = false;
  private lastStateSentAt = 0;
  private closedManually = false;

  public connect(callbacks: OnlineClientCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.closedManually = false;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.callbacks.onConnectionChange?.(true);
    };

    ws.onmessage = (event) => {
      let msg: { type?: string; payload?: unknown };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const { type, payload } = msg;
      if (type === 'session:welcome') {
        const p = payload as { playerId: string; rooms: OnlineRoomSummary[] };
        this.playerId = p.playerId;
        this.callbacks.onWelcome?.(p.playerId, p.rooms);
      } else if (type === 'room:list') {
        this.callbacks.onRoomList?.(payload as OnlineRoomSummary[]);
      } else if (type === 'room:state') {
        this.callbacks.onRoomState?.(payload as OnlineRoomSnapshot);
      } else if (type === 'match:started') {
        this.callbacks.onMatchStarted?.(payload as OnlineRoomSnapshot);
      } else if (type === 'world:snapshot') {
        this.callbacks.onWorldSnapshot?.(payload as OnlineRoomSnapshot);
      } else if (type === 'world:shot') {
        this.callbacks.onWorldShot?.(payload as OnlineShotEvent);
      } else if (type === 'player:damaged') {
        this.callbacks.onPlayerDamaged?.(payload as OnlineDamageEvent);
      } else if (type === 'player:killed') {
        this.callbacks.onPlayerKilled?.(payload as OnlineKillEvent);
      } else if (type === 'round:ended') {
        this.callbacks.onRoundEnded?.(payload as OnlineRoundEndEvent);
      } else if (type === 'round:started') {
        this.callbacks.onRoundStarted?.(payload as OnlineRoomSnapshot);
      } else if (type === 'match:ended') {
        this.callbacks.onMatchEnded?.(payload as OnlineMatchEndEvent);
      } else if (type === 'error') {
        const err = payload as { message?: string };
        this.callbacks.onError?.(err.message || 'Multiplayer server error');
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.callbacks.onConnectionChange?.(false);
      if (!this.closedManually) {
        window.setTimeout(() => {
          if (!this.closedManually) {
            this.connect(this.callbacks);
          }
        }, 1800);
      }
    };
  }

  public setMatchCallbacks(matchCallbacks: Partial<OnlineClientCallbacks>) {
    this.callbacks = { ...this.callbacks, ...matchCallbacks };
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  private send(type: string, payload: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  public refreshRooms() {
    this.send('room:list');
  }

  public createRoom(params: {
    name: string;
    mode: GameMode;
    mapId: MapId;
    spawnId: string;
    bundleColor: BundleSkinId;
  }) {
    this.send('room:create', params);
  }

  public quickMatch(params: {
    name: string;
    mode: GameMode;
    mapId: MapId;
    spawnId: string;
    bundleColor: BundleSkinId;
  }) {
    this.send('room:quick_match', params);
  }

  public joinRoom(params: {
    code: string;
    name: string;
    spawnId: string;
    bundleColor: BundleSkinId;
  }) {
    this.send('room:join', params);
  }

  public updateConfig(params: { mode?: GameMode; mapId?: MapId; spawnId?: string }) {
    this.send('room:update_config', params);
  }

  public startRoomMatch() {
    this.send('room:start');
  }

  public leaveRoom() {
    this.send('room:leave');
  }

  public sendPlayerState(state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weapon: WeaponId;
    isAiming: boolean;
  }) {
    const now = performance.now();
    if (now - this.lastStateSentAt < 48) return;
    this.lastStateSentAt = now;
    this.send('player:state', state);
  }

  public sendShoot(params: {
    weapon: WeaponId;
    origin: [number, number, number];
    dir: [number, number, number];
    hitPlayerId: string | null;
    isHeadshot: boolean;
  }) {
    this.send('player:shoot', params);
  }

  public sendRespawn(spawnId: string) {
    this.send('player:respawn', { spawnId });
  }

  public dispose() {
    this.closedManually = true;
    this.ws?.close();
    this.ws = null;
  }
}
