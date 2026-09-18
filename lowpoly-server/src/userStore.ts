import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface MatchPlayerEntry {
  sessionId: string;
  name: string;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  shotsFired: number;
  shotsHit: number;
  headshotKills: number;
  score: number;
  isMVP: boolean;
  isSVP: boolean;
}

export interface MatchRecord {
  time: number;
  result: 'win' | 'lose';
  redScore: number;
  blueScore: number;
  map: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shotsFired: number;
  shotsHit: number;
  headshotKills: number;
  isMVP: boolean;
  isSVP: boolean;
  primaryWeapon: string;
  character: string;
  players?: MatchPlayerEntry[];
}

export interface Loadout {
  primary: string;
  melee: string;
  special: string | null;
  character: string;
}

export interface FriendRequest {
  from: string;
  time: number;
}

export interface User {
  username: string;
  passwordHash: string;
  createdAt: number;
  matches: MatchRecord[];
  loadout: Loadout;
  friends: string[];
  friendRequests: FriendRequest[];
}

interface DB {
  users: Record<string, User>;
  tokens: Record<string, string>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

let db: DB = { users: {}, tokens: {} };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDB() {
  ensureDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      db = JSON.parse(raw);
      if (!db.users) db.users = {};
      if (!db.tokens) db.tokens = {};
      for (const name in db.users) {
        const u = db.users[name];
        if (!Array.isArray(u.friends)) u.friends = [];
        if (!Array.isArray(u.friendRequests)) u.friendRequests = [];
      }
      console.log(`📂 用户数据已加载：${Object.keys(db.users).length} 个账号`);
    } catch (e) {
      console.error('用户数据读取失败:', e);
      db = { users: {}, tokens: {} };
    }
  } else {
    console.log('📂 用户数据文件不存在，将创建新文件');
  }
}

export function saveDB() {
  ensureDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('用户数据保存失败:', e);
  }
}

const SALT = 'shenzhifps-2024';

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(SALT + pwd).digest('hex');
}

export function register(username: string, password: string): { ok: boolean; error?: string; token?: string } {
  username = username.trim();
  if (username.length < 2 || username.length > 16) return { ok: false, error: '用户名长度需 2-16 位' };
  if (password.length < 4) return { ok: false, error: '密码至少 4 位' };
  if (db.users[username]) return { ok: false, error: '用户名已存在' };

  const user: User = {
    username,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    matches: [],
    loadout: { primary: 'AK-47', melee: '蝴蝶刀', special: null, character: 'male_rifleman' },
    friends: [],
    friendRequests: [],
  };
  db.users[username] = user;
  const token = crypto.randomUUID();
  db.tokens[token] = username;
  saveDB();
  console.log(`✅ 新用户注册: ${username}`);
  return { ok: true, token };
}

export function login(username: string, password: string): { ok: boolean; error?: string; token?: string } {
  username = username.trim();
  const user = db.users[username];
  if (!user) return { ok: false, error: '用户名不存在' };
  if (user.passwordHash !== hashPassword(password)) return { ok: false, error: '密码错误' };
  const token = crypto.randomUUID();
  db.tokens[token] = username;
  saveDB();
  console.log(`✅ 用户登录: ${username}`);
  return { ok: true, token };
}

export function getUserByToken(token: string): User | null {
  if (!token) return null;
  const username = db.tokens[token];
  if (!username) return null;
  return db.users[username] ?? null;
}

export function saveMatch(token: string, record: MatchRecord): boolean {
  const user = getUserByToken(token);
  if (!user) return false;
  user.matches.unshift(record);
  if (user.matches.length > 50) user.matches.length = 50;
  saveDB();
  return true;
}

export function saveLoadout(token: string, loadout: Loadout): boolean {
  const user = getUserByToken(token);
  if (!user) return false;
  user.loadout = loadout;
  saveDB();
  return true;
}

// ==================== ★ 好友系统 ====================

export function searchUsers(
  token: string,
  query: string,
): { ok: boolean; users?: { username: string; isFriend: boolean; hasPendingIn: boolean; hasPendingOut: boolean }[]; error?: string } {
  const me = getUserByToken(token);
  if (!me) return { ok: false, error: '未登录' };
  const q = query.trim().toLowerCase();
  if (q.length < 1) return { ok: true, users: [] };

  const result: { username: string; isFriend: boolean; hasPendingIn: boolean; hasPendingOut: boolean }[] = [];
  for (const name in db.users) {
    if (name === me.username) continue;
    if (!name.toLowerCase().includes(q)) continue;
    if (result.length >= 20) break;
    const other = db.users[name];
    result.push({
      username: name,
      isFriend: me.friends.includes(name),
      hasPendingIn: me.friendRequests.some(r => r.from === name),
      hasPendingOut: other.friendRequests.some(r => r.from === me.username),
    });
  }
  return { ok: true, users: result };
}

export function sendFriendRequest(token: string, target: string): { ok: boolean; error?: string } {
  const me = getUserByToken(token);
  if (!me) return { ok: false, error: '未登录' };
  if (target === me.username) return { ok: false, error: '不能加自己为好友' };
  const other = db.users[target];
  if (!other) return { ok: false, error: '用户不存在' };
  if (me.friends.includes(target)) return { ok: false, error: '已经是好友' };

  if (me.friendRequests.some(r => r.from === target)) {
    me.friendRequests = me.friendRequests.filter(r => r.from !== target);
    if (!me.friends.includes(target)) me.friends.push(target);
    if (!other.friends.includes(me.username)) other.friends.push(me.username);
    saveDB();
    return { ok: true };
  }

  if (other.friendRequests.some(r => r.from === me.username)) {
    return { ok: false, error: '已发送，等待对方同意' };
  }

  other.friendRequests.push({ from: me.username, time: Date.now() });
  saveDB();
  return { ok: true };
}

export function acceptFriend(token: string, fromUser: string): { ok: boolean; error?: string } {
  const me = getUserByToken(token);
  if (!me) return { ok: false, error: '未登录' };
  const req = me.friendRequests.find(r => r.from === fromUser);
  if (!req) return { ok: false, error: '没有来自该用户的好友请求' };

  me.friendRequests = me.friendRequests.filter(r => r.from !== fromUser);
  if (!me.friends.includes(fromUser)) me.friends.push(fromUser);

  const other = db.users[fromUser];
  if (other && !other.friends.includes(me.username)) other.friends.push(me.username);

  saveDB();
  return { ok: true };
}

export function rejectFriend(token: string, fromUser: string): { ok: boolean } {
  const me = getUserByToken(token);
  if (!me) return { ok: false };
  me.friendRequests = me.friendRequests.filter(r => r.from !== fromUser);
  saveDB();
  return { ok: true };
}

export function removeFriend(token: string, target: string): { ok: boolean } {
  const me = getUserByToken(token);
  if (!me) return { ok: false };
  me.friends = me.friends.filter(f => f !== target);
  const other = db.users[target];
  if (other) other.friends = other.friends.filter(f => f !== me.username);
  saveDB();
  return { ok: true };
}

export function getMyFriends(token: string): {
  ok: boolean;
  friends?: { username: string; loadout: Loadout }[];
  requests?: { from: string; time: number }[];
  error?: string;
} {
  const me = getUserByToken(token);
  if (!me) return { ok: false, error: '未登录' };

  const friends = me.friends
    .map(name => db.users[name])
    .filter(u => !!u)
    .map(u => ({ username: u.username, loadout: u.loadout }));

  const requests = me.friendRequests
    .slice()
    .sort((a, b) => b.time - a.time)
    .map(r => ({ from: r.from, time: r.time }));

  return { ok: true, friends, requests };
}

export function getPublicProfile(
  token: string,
  targetUsername: string,
): {
  ok: boolean;
  profile?: {
    username: string;
    createdAt: number;
    matches: MatchRecord[];
    loadout: Loadout;
    isFriend: boolean;
  };
  error?: string;
} {
  const me = getUserByToken(token);
  if (!me) return { ok: false, error: '未登录' };
  const other = db.users[targetUsername];
  if (!other) return { ok: false, error: '用户不存在' };
  return {
    ok: true,
    profile: {
      username: other.username,
      createdAt: other.createdAt,
      matches: other.matches,
      loadout: other.loadout,
      isFriend: me.friends.includes(targetUsername),
    },
  };
}