import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
  isMVP: boolean;
  isSVP: boolean;
  primaryWeapon: string;
  character: string;
}

export interface Loadout {
  primary: string;
  melee: string;
  special: string | null;
  character: string;
}

export interface User {
  username: string;
  passwordHash: string;
  createdAt: number;
  matches: MatchRecord[];
  loadout: Loadout;
}

interface DB {
  users: Record<string, User>;
  tokens: Record<string, string>;
}

// ★ 优先用环境变量 DATA_DIR（Railway 挂 Volume 用），否则本地 ./data
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