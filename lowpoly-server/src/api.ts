import express from 'express';
import {
  register, login, getUserByToken, saveMatch, saveLoadout, Loadout,
  searchUsers, sendFriendRequest, acceptFriend, rejectFriend, removeFriend,
  getMyFriends, getPublicProfile,
} from './userStore.js';

export const apiRouter = express.Router();
apiRouter.use(express.json());

apiRouter.post('/register', (req, res) => {
  const { username, password } = req.body ?? {};
  const result = register(String(username ?? ''), String(password ?? ''));
  res.json(result);
});

apiRouter.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const result = login(String(username ?? ''), String(password ?? ''));
  res.json(result);
});

apiRouter.get('/profile', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const user = getUserByToken(token);
  if (!user) { res.status(401).json({ error: '未登录' }); return; }
  res.json({
    username: user.username,
    createdAt: user.createdAt,
    matches: user.matches,
    loadout: user.loadout,
  });
});

apiRouter.post('/match', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const ok = saveMatch(token, req.body);
  res.json({ ok });
});

apiRouter.post('/loadout', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const body = req.body ?? {};
  const loadout: Loadout = {
    primary: String(body.primary ?? 'AK-47'),
    melee: String(body.melee ?? '蝴蝶刀'),
    special: body.special ?? null,
    character: String(body.character ?? 'male_rifleman'),
  };
  const ok = saveLoadout(token, loadout);
  res.json({ ok });
});

// ==================== ★ 好友 API ====================

apiRouter.get('/friends', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  res.json(getMyFriends(token));
});

apiRouter.get('/search', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const q = String(req.query.q ?? '');
  res.json(searchUsers(token, q));
});

apiRouter.post('/friend-request', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const target = String(req.body?.target ?? '');
  res.json(sendFriendRequest(token, target));
});

apiRouter.post('/friend-accept', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const from = String(req.body?.from ?? '');
  res.json(acceptFriend(token, from));
});

apiRouter.post('/friend-reject', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const from = String(req.body?.from ?? '');
  res.json(rejectFriend(token, from));
});

apiRouter.post('/friend-remove', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const target = String(req.body?.target ?? '');
  res.json(removeFriend(token, target));
});

apiRouter.get('/user/:username', (req, res) => {
  const token = String(req.headers['x-token'] ?? '');
  const username = String(req.params.username ?? '');
  res.json(getPublicProfile(token, username));
});