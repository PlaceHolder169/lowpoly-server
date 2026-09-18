import { Room, Client } from '@colyseus/core';
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

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
  @type('string') specialWeapon = '';
  @type('boolean') crouching = false;
  @type('string') characterVariant = 'male_rifleman';
  @type('int16') killStreak = 0;

  @type('float32') invulnT = 0;

  @type('int16') kills = 0;
  @type('int16') deaths = 0;
  @type('int16') assists = 0;

  @type('int16') shotsFired = 0;
  @type('int16') shotsHit = 0;
  @type('int16') headshotKills = 0;
}

export class ScoreEntry extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('int16') team = 0;
  @type('int16') kills = 0;
  @type('int16') deaths = 0;
  @type('int16') assists = 0;
  @type('int16') shotsFired = 0;
  @type('int16') shotsHit = 0;
  @type('int16') headshotKills = 0;
  @type('float32') score = 0;
  @type('boolean') isMVP = false;
  @type('boolean') isSVP = false;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('string') phase = 'waiting';
  @type('int16') scoreRed = 0;
  @type('int16') scoreBlue = 0;
  @type('int16') timeLeft = 0;
  @type('int16') roundTime = 300;
  @type('string') mapName = 'dust';
  @type('int16') maxPlayers = 4;

  @type([ScoreEntry]) finalScoreboard = new ArraySchema<ScoreEntry>();
}

const VALID_PRIMARY = ['AK-47', 'M4A1', '沙鹰', 'AWP', '毛瑟', 'P90', 'S686', 'M200', 'Kar98k', '左轮', 'M14'];
const VALID_MELEE = ['匕首', '蝴蝶刀', '尼泊尔', '爪刀', '武士刀', '折刀', '电锯'];
const VALID_SPECIAL = ['复合弓', '加特林', '火箭筒', '榴弹发射器', ''];
const VALID_MAPS = ['dust', 'transport'];
const VALID_ROUND_TIMES = [180, 300, 600];
const VALID_CHARS = ['male_rifleman', 'male_heavy', 'male_scout', 'male_sniper', 'female_assault', 'female_scout', 'female_sniper', 'female_heavy'];
const VALID_MAX_CLIENTS = [2, 4, 6];

const MELEE_DAMAGE: Record<string, number> = {
  '匕首': 35, '蝴蝶刀': 55, '尼泊尔': 80, '爪刀': 45, '武士刀': 90,
  '折刀': 38, '电锯': 18,
};
const GUN_BODY_DAMAGE: Record<string, number> = {
  'AK-47': 33, 'M4A1': 28, '沙鹰': 63, 'AWP': 115,
  '毛瑟': 26, 'P90': 22, 'S686': 90, 'M200': 105, 'Kar98k': 78,
  '左轮': 55, 'M14': 42,
  '复合弓': 85, '加特林': 22,
  '火箭筒': 180, '榴弹发射器': 120,
};
const FALLOFF: Record<string, { s: number; m: number; e: number; mm: number; em: number }> = {
  'AK-47': { s: 30, m: 60, e: 120, mm: 0.70, em: 0.50 },
  'M4A1':  { s: 35, m: 70, e: 120, mm: 0.75, em: 0.55 },
  '沙鹰':  { s: 40, m: 80, e: 130, mm: 0.80, em: 0.60 },
  'AWP':   { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
  '毛瑟':  { s: 25, m: 50, e: 100, mm: 0.65, em: 0.45 },
  'P90':   { s: 20, m: 40, e: 80,  mm: 0.70, em: 0.50 },
  'S686':  { s: 8,  m: 18, e: 35,  mm: 0.50, em: 0.15 },
  'M200':  { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
  'Kar98k': { s: 60, m: 120, e: 220, mm: 0.75, em: 0.55 },
  '左轮':   { s: 35, m: 70,  e: 120, mm: 0.75, em: 0.55 },
  'M14':    { s: 50, m: 100, e: 180, mm: 0.85, em: 0.65 },
  '复合弓': { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
  '加特林': { s: 30, m: 70, e: 120, mm: 0.75, em: 0.55 },
  '火箭筒': { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
  '榴弹发射器': { s: 999, m: 999, e: 999, mm: 1.0, em: 1.0 },
};

const MELEE_SERVER_MAX_DIST = 4.0;
const ASSIST_WINDOW_MS = 5000;
const RESPAWN_INVULN_SEC = 2.0;

const SPAWNS: Record<string, {
  red: { x: number; z: number }[];
  blue: { x: number; z: number }[];
}> = {
  dust: {
    red: [
      { x: -44, z: -4 }, { x: -44, z: 0 }, { x: -44, z: 4 },
      { x: -40, z: -3 }, { x: -40, z: 3 },
    ],
    blue: [
      { x: 44, z: -4 }, { x: 44, z: 0 }, { x: 44, z: 4 },
      { x: 40, z: -3 }, { x: 40, z: 3 },
    ],
  },
  transport: {
    red: [
      { x: -18.5, z: 0 }, { x: -18, z: -5 }, { x: -18, z: 5 },
      { x: -15, z: -3 }, { x: -15, z: 3 },
    ],
    blue: [
      { x: 18.5, z: 0 }, { x: 18, z: -5 }, { x: 18, z: 5 },
      { x: 15, z: -3 }, { x: 15, z: 3 },
    ],
  },
};

function randomSpawn(team: number, mapName: string) {
  const cfg = SPAWNS[mapName] ?? SPAWNS.dust;
  const list = team === 0 ? cfg.red : cfg.blue;
  const p = list[Math.floor(Math.random() * list.length)];
  return { x: p.x, y: 0, z: p.z };
}

export class GameRoom extends Room<GameState> {
  maxClients = 8;

  private timer: NodeJS.Timeout | null = null;
  private invulnTimer: NodeJS.Timeout | null = null;
  private damageHistory = new Map<string, Map<string, number>>();

  private syncMetadata() {
    const existing = (this.metadata as any) ?? {};
    this.setMetadata({
      roomName: existing.roomName ?? '未命名',
      mapName: this.state.mapName,
      roundTime: this.state.roundTime,
      phase: this.state.phase,
    });
  }

  onCreate(options: any) {
    this.setState(new GameState());

    const roomName = String(options?.roomName ?? '').slice(0, 20).trim() || '未命名';

    const reqMax = Number(options?.maxClients);
    if (VALID_MAX_CLIENTS.includes(reqMax)) this.maxClients = reqMax;
    else this.maxClients = 4;
    this.state.maxPlayers = this.maxClients;

    if (typeof options?.mapName === 'string' && VALID_MAPS.includes(options.mapName)) {
      this.state.mapName = options.mapName;
    }
    if (typeof options?.roundTime === 'number' && VALID_ROUND_TIMES.includes(options.roundTime)) {
      this.state.roundTime = options.roundTime;
    }

    this.setMetadata({
      roomName,
      mapName: this.state.mapName,
      roundTime: this.state.roundTime,
      phase: this.state.phase,
    });

    console.error(`🎮 新房间已创建: "${roomName}" (maxClients=${this.maxClients}, map=${this.state.mapName})`);

    this.invulnTimer = setInterval(() => {
      if (this.state.phase !== 'playing') return;
      this.state.players.forEach((p) => {
        if (p.invulnT > 0) {
          p.invulnT = Math.max(0, p.invulnT - 0.1);
        }
      });
    }, 100);

    this.onMessage('ready', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = data.ready === true;
    });

    this.onMessage('switchTeam', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.phase !== 'waiting') return;
      const targetTeam = p.team === 0 ? 1 : 0;
      const perTeam = this.maxClients / 2;
      let count = 0;
      this.state.players.forEach((pl) => { if (pl.team === targetTeam) count++; });
      if (count >= perTeam) return;
      p.team = targetTeam;
      const s = randomSpawn(p.team, this.state.mapName);
      p.x = s.x; p.y = s.y; p.z = s.z;
    });

    this.onMessage('settings', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.isHost) return;
      if (this.state.phase !== 'waiting') return;
      if (typeof data?.roundTime === 'number' && VALID_ROUND_TIMES.includes(data.roundTime)) {
        this.state.roundTime = data.roundTime;
      }
      if (typeof data?.mapName === 'string' && VALID_MAPS.includes(data.mapName)) {
        this.state.mapName = data.mapName;
      }
      this.syncMetadata();
    });

    this.onMessage('loadout', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.phase !== 'playing' && this.state.phase !== 'waiting') return;
      if (typeof data?.primary === 'string' && VALID_PRIMARY.includes(data.primary)) {
        p.primaryWeapon = data.primary;
        p.weapon = data.primary;
      }
      if (typeof data?.melee === 'string' && VALID_MELEE.includes(data.melee)) {
        p.meleeWeapon = data.melee;
      }
      if (typeof data?.special === 'string' && VALID_SPECIAL.includes(data.special)) {
        p.specialWeapon = data.special;
      }
    });

    this.onMessage('startGame', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.isHost) return;

      if (this.state.phase === 'settled') {
        this.state.phase = 'waiting';
        this.state.scoreRed = 0;
        this.state.scoreBlue = 0;
        this.state.timeLeft = 0;
        this.state.finalScoreboard.clear();
        this.damageHistory.clear();
        this.state.players.forEach((pl) => {
          pl.ready = true;
          pl.health = 100;
          pl.kills = 0;
          pl.deaths = 0;
          pl.assists = 0;
          pl.shotsFired = 0;
          pl.shotsHit = 0;
          pl.headshotKills = 0;
          pl.killStreak = 0;
        });
        this.syncMetadata();
      }

      if (this.state.phase !== 'waiting') return;
      let count = 0; let allReady = true;
      this.state.players.forEach((pl) => { count++; if (!pl.ready) allReady = false; });
      if (!allReady || count < 2) return;

      this.state.phase = 'playing';
      this.state.scoreRed = 0;
      this.state.scoreBlue = 0;
      this.state.timeLeft = this.state.roundTime;
      this.state.finalScoreboard.clear();
      this.damageHistory.clear();
      this.syncMetadata();

      this.state.players.forEach((pl, sid) => {
        pl.health = 100;
        pl.killStreak = 0;
        pl.kills = 0;
        pl.deaths = 0;
        pl.assists = 0;
        pl.shotsFired = 0;
        pl.shotsHit = 0;
        pl.headshotKills = 0;
        pl.ready = false;
        pl.invulnT = RESPAWN_INVULN_SEC;
        const s = randomSpawn(pl.team, this.state.mapName);
        pl.x = s.x; pl.y = s.y; pl.z = s.z;
        pl.weapon = pl.primaryWeapon;
        this.clients.find(c => c.sessionId === sid)?.send('spawn', s);
      });

      console.error(`🚀 游戏开始 (map=${this.state.mapName})`);
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.state.phase !== 'playing') return;
        this.state.timeLeft = Math.max(0, this.state.timeLeft - 1);
        if (this.state.timeLeft <= 0) {
          this.endMatch();
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

    this.onMessage('iaido', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      this.broadcast('iaido', {
        from: client.sessionId,
        x: p.x, y: p.y, z: p.z,
        yaw: p.rotY,
      }, { except: client });
    });

    this.onMessage('chat', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const text = String(data?.text ?? '').slice(0, 100);
      if (!text) return;
      const channel = data?.channel === 'team' ? 'team' : 'all';
      const payload = {
        from: client.sessionId,
        name: p.name,
        team: p.team,
        channel,
        text,
      };
      if (channel === 'team') {
        this.state.players.forEach((pl, sid) => {
          if (pl.team !== p.team) return;
          const c = this.clients.find(cc => cc.sessionId === sid);
          c?.send('chat', payload);
        });
      } else {
        this.broadcast('chat', payload);
      }
    });

    this.onMessage('tracer', (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      const ox = Number(data?.ox), oy = Number(data?.oy), oz = Number(data?.oz);
      const tx = Number(data?.tx), ty = Number(data?.ty), tz = Number(data?.tz);
      if (![ox, oy, oz, tx, ty, tz].every(Number.isFinite)) return;
      this.broadcast('tracer', {
        from: client.sessionId,
        ox, oy, oz, tx, ty, tz,
      }, { except: client });
    });

    this.onMessage('shoot', (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      if (this.state.phase !== 'playing') return;

      const hitTarget = data?.hitTarget;
      const isHead = data?.isHead === true;
      const weaponKind = data?.weaponKind === 'melee' ? 'melee' : 'gun';

      shooter.shotsFired += 1;

      if (!hitTarget) return;
      const target = this.state.players.get(hitTarget);
      if (!target) return;
      if (target.team === shooter.team) return;
      if (target.health <= 0) return;

      if (target.invulnT > 0) return;

      const dx = target.x - shooter.x;
      const dz = target.z - shooter.z;
      const serverDistance = Math.hypot(dx, dz);

      if (weaponKind === 'melee') {
        if (serverDistance > MELEE_SERVER_MAX_DIST) return;
      } else {
        if (serverDistance > 200) return;
      }

      shooter.shotsHit += 1;

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

      let history = this.damageHistory.get(hitTarget);
      if (!history) {
        history = new Map();
        this.damageHistory.set(hitTarget, history);
      }
      history.set(client.sessionId, Date.now());

      // ★ 通知被打的人：谁打的、从哪打、掉多少血
      const targetClient = this.clients.find(c => c.sessionId === hitTarget);
      targetClient?.send('hurt', {
        from: client.sessionId,
        x: shooter.x,
        z: shooter.z,
        damage: dmg,
        isHead,
      });

      console.error(`💥 ${shooter.name} (${weaponName}) → ${target.name} -${dmg} (剩余 ${target.health})`);

      if (target.health <= 0) {
        if (target.team === 0) this.state.scoreBlue++;
        else this.state.scoreRed++;

        const now = Date.now();
        const assists: string[] = [];
        const assistNames: string[] = [];
        if (history) {
          history.forEach((ts, damagerId) => {
            if (damagerId === client.sessionId) return;
            if (now - ts > ASSIST_WINDOW_MS) return;
            const damager = this.state.players.get(damagerId);
            if (damager && damager.team !== target.team && damager.health > 0) {
              assists.push(damagerId);
              assistNames.push(damager.name);
            }
          });
        }
        this.damageHistory.delete(hitTarget);

        shooter.killStreak += 1;
        target.killStreak = 0;
        shooter.kills += 1;
        if (isHead) shooter.headshotKills += 1;
        target.deaths += 1;
        for (const aid of assists) {
          const ap = this.state.players.get(aid);
          if (ap) ap.assists += 1;
        }

        this.broadcast('kill', {
          killer: client.sessionId, killerName: shooter.name,
          victim: hitTarget, victimName: target.name,
          isHead, distance: serverDistance,
          weapon: weaponName,
          killerStreak: shooter.killStreak,
          assists, assistNames,
        });

        const victimId = hitTarget;
        setTimeout(() => {
          if (this.state.phase !== 'playing') return;
          const p = this.state.players.get(victimId);
          if (p) {
            p.health = 100;
            p.invulnT = RESPAWN_INVULN_SEC;
            const s = randomSpawn(p.team, this.state.mapName);
            p.x = s.x; p.y = s.y; p.z = s.z;
            p.weapon = p.primaryWeapon;
            const vc = this.clients.find(c => c.sessionId === victimId);
            vc?.send('spawn', s);
          }
        }, 3000);
      }
    });
  }

  private endMatch() {
    this.state.phase = 'settled';
    this.syncMetadata();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }

    console.error('🏁 对局结束，开始结算');

    type Stat = {
      id: string; name: string; team: number;
      kills: number; deaths: number; assists: number;
      shotsFired: number; shotsHit: number; headshotKills: number;
      score: number; isMVP: boolean; isSVP: boolean;
    };

    const stats: Stat[] = [];
    this.state.players.forEach((p, sid) => {
      const score =
        p.kills * 150 +
        p.assists * 50 +
        p.headshotKills * 30 +
        p.shotsHit * 10 -
        p.deaths * 40;

      stats.push({
        id: sid,
        name: p.name,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        shotsFired: p.shotsFired,
        shotsHit: p.shotsHit,
        headshotKills: p.headshotKills,
        score: Math.max(0, score),
        isMVP: false,
        isSVP: false,
      });
    });

    const sorted = [...stats].sort((a, b) => b.score - a.score);
    if (sorted.length >= 1) sorted[0].isMVP = true;
    if (sorted.length >= 2) sorted[1].isSVP = true;

    this.state.finalScoreboard.clear();
    for (const s of stats) {
      const entry = new ScoreEntry();
      entry.sessionId = s.id;
      entry.name = s.name;
      entry.team = s.team;
      entry.kills = s.kills;
      entry.deaths = s.deaths;
      entry.assists = s.assists;
      entry.shotsFired = s.shotsFired;
      entry.shotsHit = s.shotsHit;
      entry.headshotKills = s.headshotKills;
      entry.score = s.score;
      entry.isMVP = s.isMVP;
      entry.isSVP = s.isSVP;
      this.state.finalScoreboard.push(entry);
    }

    const scoreboardData = stats.map(s => ({
      sessionId: s.id,
      name: s.name,
      team: s.team,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      shotsFired: s.shotsFired,
      shotsHit: s.shotsHit,
      headshotKills: s.headshotKills,
      score: s.score,
      isMVP: s.isMVP,
      isSVP: s.isSVP,
    }));

    this.broadcast('matchEnd', {
      redScore: this.state.scoreRed,
      blueScore: this.state.scoreBlue,
      scoreboard: scoreboardData,
    });

    console.error('📊 结算数据：', sorted.map(s => `${s.name}: ${s.score}${s.isMVP ? ' MVP' : s.isSVP ? ' SVP' : ''}`).join(' | '));
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
    if (typeof options?.specialWeapon === 'string' && options.specialWeapon && VALID_SPECIAL.includes(options.specialWeapon)) {
      player.specialWeapon = options.specialWeapon;
    }
    if (typeof options?.characterVariant === 'string' && VALID_CHARS.includes(options.characterVariant)) {
      player.characterVariant = options.characterVariant;
    }
    player.weapon = player.primaryWeapon;

    const perTeam = this.maxClients / 2;
    let red = 0, blue = 0;
    this.state.players.forEach((p) => p.team === 0 ? red++ : blue++);
    if (red < perTeam && red <= blue) player.team = 0;
    else if (blue < perTeam) player.team = 1;
    else player.team = red <= blue ? 0 : 1;

    const s = randomSpawn(player.team, this.state.mapName);
    player.x = s.x; player.y = s.y; player.z = s.z;

    this.state.players.set(client.sessionId, player);
    console.error(`👤 加入: ${player.name} (${this.clients.length}/${this.maxClients})`);

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
    if (this.state.players.size === 0 && this.state.phase !== 'waiting') {
      this.state.phase = 'waiting';
      this.state.finalScoreboard.clear();
      this.damageHistory.clear();
      this.syncMetadata();
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
  }

  onDispose() {
    if (this.timer) clearInterval(this.timer);
    if (this.invulnTimer) { clearInterval(this.invulnTimer); this.invulnTimer = null; }
    console.error('🛑 房间已销毁');
  }
}