import { Room, Client } from '@colyseus/core';
import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') name = '';
  @type('boolean') ready = false;
  @type('boolean') isHost = false;
  @type('int16') team = 0;
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  @type('float32') rotY = 0;
  @type('float32') rotX = 0;
  @type('int16') health = 100;
  @type('string') weapon = 'AK-47';
  @type('string') primaryWeapon = 'AK-47';
  @type('string') meleeWeapon = '蝴蝶刀';
  @type('boolean') crouching = false;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('string') phase = 'waiting';
  @type('int16') scoreRed = 0;
  @type('int16') scoreBlue = 0;
  @type('int16') timeLeft = 0;
  // ===== 房间设置 =====
  @type('int16') roundTime = 300;      // 局时（秒）
  @type('string') mapName = 'dust';    // 地图名
}

const VALID_PRIMARY = ['AK-47', 'M4A1', '沙鹰', 'AWM'];
const VALID_MELEE = ['匕首', '蝴蝶刀', '尼泊尔'];
const VALID_MAPS = ['dust'];
const VALID_ROUND_TIMES = [180, 300, 600];

const MELEE_DAMAGE: Record<string, number> = { '匕首': 35, '蝴蝶刀': 55, '尼泊尔': 80 };
const GUN_BODY_DAMAGE: Record<string, number> = { 'AK-47': 33, 'M4A1': 28, '沙鹰': 63, 'AWM': 115 };
const FALLOFF: Record<string, { s: number; m: number; e: number; mm: number; em: number }> = {
  'AK-47': { s: 30, m: 60, e: 120, mm: 0.70, em: 0.50 },
  'M4A1':  { s: 35, m: 70, e: 120, mm: 0.75, em: 0.55 },
  '沙鹰':  { s: 40, m: 80, e: 130, mm: 0.80, em: 0.60 },
  'AWM':   { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
};

const MELEE_SERVER_MAX_DIST = 2.5;

const RED_SPAWN  = { xMin: -46, xMax: -40, zMin: -8, zMax: 8 };
const BLUE_SPAWN = { xMin:  40, xMax:  46, zMin: -8, zMax: 8 };

function randomSpawn(team: number) {
  const area = team === 0 ? RED_SPAWN : BLUE_SPAWN;
  const x = area.xMin + Math.random() * (area.xMax - area.xMin);
  const z = area.zMin + Math.random() * (area.zMax - area.zMin);
  return { x, y: 0, z };
}

export class GameRoom extends Room<GameState> {
  maxClients = 4;
  private timer: NodeJS.Timeout | null = null;

  onCreate() {
    this.setState(new GameState());
    console.error('🎮 新房间已创建');

    this.onMessage('ready', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = data.ready === true;
    });

    this.onMessage('switchTeam', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.phase !== 'waiting') return;
      p.team = p.team === 0 ? 1 : 0;
      const s = randomSpawn(p.team);
      p.x = s.x; p.y = s.y; p.z = s.z;
    });

    // ===== 房间设置（仅房主可改） =====
    this.onMessage('settings', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.isHost) return;
      if (this.state.phase !== 'waiting') return;
      if (typeof data?.roundTime === 'number' && VALID_ROUND_TIMES.includes(data.roundTime)) {
        this.state.roundTime = data.roundTime;
        console.error(`⏱️ 局时改为: ${data.roundTime}s`);
      }
      if (typeof data?.mapName === 'string' && VALID_MAPS.includes(data.mapName)) {
        this.state.mapName = data.mapName;
        console.error(`🗺️ 地图改为: ${data.mapName}`);
      }
    });

    this.onMessage('loadout', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== 'waiting') return;
      if (typeof data?.primary === 'string' && VALID_PRIMARY.includes(data.primary)) {
        p.primaryWeapon = data.primary;
        p.weapon = data.primary;
      }
      if (typeof data?.melee === 'string' && VALID_MELEE.includes(data.melee)) {
        p.meleeWeapon = data.melee;
      }
    });

    this.onMessage('startGame', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.isHost) return;
      if (this.state.phase !== 'waiting') return;
      let count = 0; let allReady = true;
      this.state.players.forEach((pl) => { count++; if (!pl.ready) allReady = false; });
      if (!allReady || count < 2) return;
      this.state.phase = 'playing';
      this.state.scoreRed = 0; this.state.scoreBlue = 0;
      this.state.timeLeft = this.state.roundTime;

      this.state.players.forEach((pl, sid) => {
        pl.health = 100;
        const s = randomSpawn(pl.team);
        pl.x = s.x; pl.y = s.y; pl.z = s.z;
        pl.weapon = pl.primaryWeapon;
        this.clients.find(c => c.sessionId === sid)?.send('spawn', s);
      });

      console.error(`🚀 游戏开始 (时长 ${this.state.roundTime}s, 地图 ${this.state.mapName})`);
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.state.phase !== 'playing') return;
        this.state.timeLeft = Math.max(0, this.state.timeLeft - 1);
        if (this.state.timeLeft <= 0) {
          this.state.phase = 'waiting';
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
        }
      }, 1000);
    });

    this.onMessage('move', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.x = data.x; p.y = data.y; p.z = data.z;
        p.rotX = data.rotX; p.rotY = data.rotY;
        if (typeof data.crouching === 'boolean') p.crouching = data.crouching;
      }
    });

    this.onMessage('weapon', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (p && typeof data?.name === 'string') p.weapon = data.name;
    });

    // ===== 弹道广播 =====
    this.onMessage('tracer', (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      // 基本数值校验
      const ox = Number(data?.ox), oy = Number(data?.oy), oz = Number(data?.oz);
      const tx = Number(data?.tx), ty = Number(data?.ty), tz = Number(data?.tz);
      if (![ox, oy, oz, tx, ty, tz].every(Number.isFinite)) return;
      // 转发给其他客户端
      this.broadcast('tracer', {
        from: client.sessionId,
        ox, oy, oz, tx, ty, tz,
      }, { except: client });
    });

    this.onMessage('shoot', (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      const hitTarget = data?.hitTarget;
      const isHead = data?.isHead === true;
      const weaponKind = data?.weaponKind === 'melee' ? 'melee' : 'gun';

      if (!hitTarget) return;
      const target = this.state.players.get(hitTarget);
      if (!target) return;
      if (target.team === shooter.team) return;
      if (target.health <= 0) return;

      const dx = target.x - shooter.x;
      const dz = target.z - shooter.z;
      const serverDistance = Math.hypot(dx, dz);

      if (weaponKind === 'melee') {
        if (serverDistance > MELEE_SERVER_MAX_DIST) {
          console.error(`🚫 ${shooter.name} 近战距离异常: ${serverDistance.toFixed(1)}m`);
          return;
        }
      } else {
        if (serverDistance > 200) return;
      }

      const weaponName = shooter.weapon;
      let dmg = 0;
      if (weaponKind === 'melee') {
        dmg = MELEE_DAMAGE[weaponName] ?? 35;
      } else {
        const base = GUN_BODY_DAMAGE[weaponName] ?? 33;
        if (isHead) dmg = 999;
        else {
          const f = FALLOFF[weaponName] ?? FALLOFF['AK-47'];
          dmg = this.applyFalloff(base, serverDistance, f.s, f.m, f.e, f.mm, f.em);
        }
      }
      dmg = Math.max(1, Math.round(dmg));
      target.health = Math.max(0, target.health - dmg);
      console.error(`💥 ${shooter.name} (${weaponName}) → ${target.name} 距离 ${serverDistance.toFixed(1)}m -${dmg} (剩余 ${target.health})`);

      if (target.health <= 0) {
        if (target.team === 0) this.state.scoreBlue++;
        else this.state.scoreRed++;
        this.broadcast('kill', {
          killer: client.sessionId, killerName: shooter.name,
          victim: hitTarget, victimName: target.name,
          isHead, distance: serverDistance,
        });

        const victimId = hitTarget;
        setTimeout(() => {
          const p = this.state.players.get(victimId);
          if (p) {
            p.health = 100;
            const s = randomSpawn(p.team);
            p.x = s.x; p.y = s.y; p.z = s.z;
            p.weapon = p.primaryWeapon;
            const vc = this.clients.find(c => c.sessionId === victimId);
            vc?.send('spawn', s);
          }
        }, 3000);
      }
    });
  }

  private applyFalloff(base: number, dist: number, s: number, m: number, e: number, mm: number, em: number): number {
    if (dist <= s) return base;
    if (dist <= m) { const t = (dist - s) / (m - s); return base * (1 - t * (1 - mm)); }
    if (dist <= e) { const t = (dist - m) / (e - m); return base * (mm - t * (mm - em)); }
    return base * em;
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.name = (options?.name || '无名氏').toString().slice(0, 12);
    player.isHost = this.state.players.size === 0;
    if (typeof options?.primaryWeapon === 'string' && VALID_PRIMARY.includes(options.primaryWeapon)) {
      player.primaryWeapon = options.primaryWeapon;
    }
    if (typeof options?.meleeWeapon === 'string' && VALID_MELEE.includes(options.meleeWeapon)) {
      player.meleeWeapon = options.meleeWeapon;
    }
    player.weapon = player.primaryWeapon;

    let red = 0, blue = 0;
    this.state.players.forEach((p) => p.team === 0 ? red++ : blue++);
    player.team = red <= blue ? 0 : 1;

    const s = randomSpawn(player.team);
    player.x = s.x; player.y = s.y; player.z = s.z;

    this.state.players.set(client.sessionId, player);
    console.error(`👤 加入: ${player.name} 队 ${player.team} 装备: ${player.primaryWeapon} + ${player.meleeWeapon}`);

    client.send('spawn', s);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (p) console.error(`👋 离开: ${p.name}`);
    if (p?.isHost && this.state.players.size > 0) {
      const first = this.state.players.values().next().value;
      if (first) first.isHost = true;
    }
  }

  onDispose() {
    if (this.timer) clearInterval(this.timer);
    console.error('🛑 房间已销毁');
  }
}