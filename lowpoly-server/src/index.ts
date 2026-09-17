import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom.js';
import { apiRouter } from './api.js';
import { loadDB } from './userStore.js';

// ★ Railway 会注入 PORT 环境变量，本地默认 2567
const port = Number(process.env.PORT) || 2567;

// 启动时加载用户数据
loadDB();

const app = express();
const httpServer = createServer(app);

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// 账号 API
app.use('/api', apiRouter);

// 房间列表
app.get('/rooms', async (_req, res) => {
  try {
    const rooms: any[] = await matchMaker.query({ name: 'game_room' });
    const list = rooms.map((r: any) => ({
      roomId: r.roomId,
      name: r.metadata?.roomName ?? ('房间 ' + r.roomId.slice(0, 4).toUpperCase()),
      mapName: r.metadata?.mapName ?? 'dust',
      roundTime: r.metadata?.roundTime ?? 300,
      phase: r.metadata?.phase ?? 'waiting',
      maxClients: r.maxClients,
      clients: r.clients,
    }));
    res.json(list);
  } catch (e) {
    console.error('查询房间失败:', e);
    res.json([]);
  }
});

// 健康检查（Railway 用它判断服务是否活着）
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 5000,
    pingMaxRetries: 3,
  }),
});

gameServer.define('game_room', GameRoom);

// ★ 绑定 0.0.0.0，否则 Railway 外部访问不到
gameServer.listen(port, '0.0.0.0').then(() => {
  console.log(`✅ 联机服务器已启动，监听端口: ${port}`);
});