import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom.js';

// Railway 会注入 PORT 环境变量，本地开发用 2567
const port = Number(process.env.PORT) || 2567;

const gameServer = new Server({
  transport: new WebSocketTransport({
    pingInterval: 5000,
    pingMaxRetries: 3,
  }),
});

gameServer.define('game_room', GameRoom);

gameServer.listen(port, '0.0.0.0').then(() => {
  console.log(`✅ 联机服务器已启动，监听端口: ${port}`);
});