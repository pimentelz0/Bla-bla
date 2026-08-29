import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  dbFindUserByToken,
  dbUpdateUserLastSeen,
  dbGetConversationById,
  dbMarkMessagesAsRead,
} from './server/supabase';
import { createExpressApp } from './server/app';

const userSockets = new Map<string, Set<WebSocket>>();

function getOnlineUserIds(): Set<string> {
  const online = new Set<string>();
  for (const [userId, sockets] of userSockets.entries()) {
    if (sockets.size > 0) {
      online.add(userId);
    }
  }
  return online;
}

function broadcastToUser(userId: string, data: any): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastPresence(userId: string, isOnline: boolean, lastSeen: string): void {
  const payload = JSON.stringify({
    type: 'user:presence',
    payload: { user_id: userId, is_online: isOnline, last_seen: lastSeen },
  });

  for (const [, sockets] of userSockets.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

async function startServer() {
  const PORT = 3000;
  const app = createExpressApp({
    getOnlineUserIds,
    broadcastToUser,
  });

  // --- Vite & Static Asset Handling ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- Create HTTP & WebSocket Server on Port 3000 ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let authenticatedUserId: string | null = null;

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'auth') {
          const token = data.token;
          const user = await dbFindUserByToken(token);
          if (user) {
            authenticatedUserId = user.id;
            if (!userSockets.has(user.id)) {
              userSockets.set(user.id, new Set());
            }
            userSockets.get(user.id)!.add(ws);

            const now = new Date().toISOString();
            await dbUpdateUserLastSeen(user.id, now);

            ws.send(JSON.stringify({ type: 'auth:success', payload: { user_id: user.id } }));
            broadcastPresence(user.id, true, now);
          } else {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Token inválido' }));
          }
        } else if (data.type === 'read_conversation') {
          if (!authenticatedUserId) return;
          const convId = data.conversation_id;
          const conv = await dbGetConversationById(convId);
          if (!conv) return;

          await dbMarkMessagesAsRead(convId, authenticatedUserId);
          const otherUserId = conv.user_1 === authenticatedUserId ? conv.user_2 : conv.user_1;
          broadcastToUser(otherUserId, {
            type: 'message:read',
            payload: { conversation_id: convId, reader_id: authenticatedUserId },
          });
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', async () => {
      if (authenticatedUserId) {
        const userSet = userSockets.get(authenticatedUserId);
        if (userSet) {
          userSet.delete(ws);
          if (userSet.size === 0) {
            userSockets.delete(authenticatedUserId);
            const now = new Date().toISOString();
            await dbUpdateUserLastSeen(authenticatedUserId, now);
            broadcastPresence(authenticatedUserId, false, now);
          }
        }
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blá Blá Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
