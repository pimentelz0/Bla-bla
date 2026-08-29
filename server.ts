import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  DbUser,
  DbConversation,
  DbMessage,
  DbPin,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_URL,
  checkSupabaseConnection,
  dbFindUserByUsername,
  dbFindUserById,
  dbFindUserByToken,
  dbCreateUser,
  dbUpdateUser,
  dbUpdateUserLastSeen,
  dbSearchUsers,
  dbGetConversationById,
  dbGetOrCreateConversation,
  dbGetUserConversations,
  dbUpdateConversationLastMessage,
  dbGetMessages,
  dbCreateMessage,
  dbMarkMessagesAsRead,
  dbCountUnreadMessages,
  dbGetUserPins,
  dbSetPin,
  dbSaveToken,
  dbDeleteToken,
  dbDeleteConversation,
  dbClearConversationMessages,
  dbToggleArchive,
  dbIsArchived,
  dbToggleMute,
  dbIsMuted,
  dbToggleBlock,
  dbIsBlocked,
  dbToggleManualUnread,
  dbIsManualUnread,
} from './server/supabase';

import { INVENTED_EMOJIS } from './src/utils/customAvatars';

function hashPassword(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

const DEFAULT_AVATARS = INVENTED_EMOJIS.map((e) => e.url);

// --- WebSocket Presence & Broadcasting ---
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

function sanitizeUser(
  u: { id: string; username: string; profile_photo: string; created_at: string; updated_at: string; last_seen: string },
  onlineSet = getOnlineUserIds(),
) {
  return {
    id: u.id,
    username: u.username,
    profile_photo: u.profile_photo,
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_seen: u.last_seen,
    is_online: onlineSet.has(u.id),
  };
}

// --- Express App Setup ---
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // --- Supabase Status & Schema Endpoint ---
  app.get('/api/supabase/status', async (req, res) => {
    const status = await checkSupabaseConnection();
    return res.json({
      supabase_url: SUPABASE_URL,
      connected: status.connected,
      tables_exist: status.tablesExist,
      error: status.error,
      schema_sql: SUPABASE_SQL_SCHEMA,
    });
  });

  // --- Auth Middleware ---
  async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
    }
    const token = authHeader.substring(7).trim();
    const user = await dbFindUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    (req as any).user = user;
    (req as any).token = token;
    next();
  }

  // --- Auth Routes ---
  app.post('/api/auth/register', async (req, res) => {
    let { username, pin, profile_photo } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Nome de usuário obrigatório.' });
    }

    username = username.trim().toLowerCase().replace(/^@/, '');

    // Validate username: 3-20 characters, letters, numbers, underscores only
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _ sem espaços).',
      });
    }

    // Check duplicate in Supabase
    const existing = await dbFindUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Esse nome de usuário já está sendo usado.' });
    }

    // Validate PIN: exactly 4 numeric digits
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'A senha deve conter exatamente 4 números.' });
    }

    if (!profile_photo || typeof profile_photo !== 'string') {
      const randIndex = Math.floor(Math.random() * DEFAULT_AVATARS.length);
      profile_photo = DEFAULT_AVATARS[randIndex];
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = hashPassword(pin.trim(), salt);
    const userId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newUser: DbUser = {
      id: userId,
      username,
      salt,
      password_hash,
      profile_photo,
      created_at: now,
      updated_at: now,
      last_seen: now,
    };

    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    await dbCreateUser(newUser, token);

    return res.status(201).json({
      token,
      user: sanitizeUser(newUser),
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    let { username, pin } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Informe o nome de usuário.' });
    }
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'A senha deve conter 4 dígitos.' });
    }

    username = username.trim().toLowerCase().replace(/^@/, '');
    const user = await dbFindUserByUsername(username);

    if (!user) {
      return res.status(400).json({ error: 'Usuário ou senha incorretos.' });
    }

    const testHash = hashPassword(pin.trim(), user.salt);
    if (testHash !== user.password_hash) {
      return res.status(400).json({ error: 'Usuário ou senha incorretos.' });
    }

    const now = new Date().toISOString();
    await dbUpdateUserLastSeen(user.id, now);
    user.last_seen = now;

    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    await dbSaveToken(token, user.id);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    const now = new Date().toISOString();
    await dbUpdateUserLastSeen(user.id, now);
    user.last_seen = now;
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', authenticate, async (req, res) => {
    const token = (req as any).token as string;
    await dbDeleteToken(token);
    return res.json({ success: true });
  });

  app.post('/api/auth/update_profile', authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    let { username, pin, profile_photo } = req.body;

    const updates: Partial<DbUser> = {};

    if (username && typeof username === 'string') {
      username = username.trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({
          error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _).',
        });
      }
      const existing = await dbFindUserByUsername(username);
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ error: 'Esse nome de usuário já está sendo usado.' });
      }
      updates.username = username;
    }

    if (pin && typeof pin === 'string') {
      if (!/^\d{4}$/.test(pin.trim())) {
        return res.status(400).json({ error: 'A nova senha deve ter exatamente 4 números.' });
      }
      const newSalt = crypto.randomBytes(16).toString('hex');
      updates.salt = newSalt;
      updates.password_hash = hashPassword(pin.trim(), newSalt);
    }

    if (profile_photo && typeof profile_photo === 'string') {
      updates.profile_photo = profile_photo;
    }

    const updatedUser = await dbUpdateUser(user.id, updates);
    return res.json({ user: sanitizeUser(updatedUser || user) });
  });

  // --- Users Search Route ---
  app.get('/api/users/search', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const query = ((req.query.q as string) || '').trim().replace(/^@/, '');

    if (!query) {
      return res.json({ users: [] });
    }

    const onlineSet = getOnlineUserIds();
    const users = await dbSearchUsers(currentUserId, query);

    const matches = users.map((u) => {
      const sorted = [currentUserId, u.id].sort();
      const convId = `c_${sorted[0]}_${sorted[1]}`;
      return {
        ...sanitizeUser(u, onlineSet),
        conversation_id: convId,
      };
    });

    return res.json({ users: matches });
  });

  // --- Conversations Routes ---
  app.get('/api/conversations', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const onlineSet = getOnlineUserIds();

    const userPins = await dbGetUserPins(currentUserId);
    const pinMap = new Map<string, number>();
    userPins.forEach((p) => pinMap.set(p.conversation_id, p.position));

    const conversations = await dbGetUserConversations(currentUserId);

    const summaries = await Promise.all(
      conversations.map(async (c) => {
        const otherUserId = c.user_1 === currentUserId ? c.user_2 : c.user_1;
        const otherUser = (await dbFindUserById(otherUserId)) || {
          id: otherUserId,
          username: 'desconhecido',
          profile_photo: DEFAULT_AVATARS[0],
          created_at: '',
          updated_at: '',
          last_seen: '',
          password_hash: '',
          salt: '',
        };

        const unreadCount = await dbCountUnreadMessages(c.id, currentUserId);
        const isPinned = pinMap.has(c.id);
        const isMuted = await dbIsMuted(currentUserId, c.id);
        const isArchived = await dbIsArchived(currentUserId, c.id);
        const isBlocked = await dbIsBlocked(currentUserId, otherUserId);
        const isManualUnread = await dbIsManualUnread(currentUserId, c.id);

        return {
          id: c.id,
          other_user: sanitizeUser(otherUser, onlineSet),
          last_message: c.last_message || '',
          last_message_at: c.last_message_at || c.updated_at || c.created_at,
          last_sender_id: c.last_sender_id,
          unread_count: isManualUnread ? Math.max(1, unreadCount) : unreadCount,
          is_pinned: isPinned,
          pin_position: isPinned ? pinMap.get(c.id) : undefined,
          is_muted: isMuted,
          is_archived: isArchived,
          is_blocked: isBlocked,
        };
      }),
    );

    // Sort: pinned first (by position), then by last_message_at descending
    summaries.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      if (a.is_pinned && b.is_pinned) {
        return (a.pin_position ?? 0) - (b.pin_position ?? 0);
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    return res.json({ conversations: summaries });
  });

  app.post('/api/conversations/open', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      return res.status(400).json({ error: 'Usuário de destino inválido.' });
    }

    if (target_user_id === currentUserId) {
      return res.status(400).json({ error: 'Você não pode abrir conversa consigo mesmo.' });
    }

    const otherUser = await dbFindUserById(target_user_id);
    if (!otherUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const conversation = await dbGetOrCreateConversation(currentUserId, target_user_id);
    const onlineSet = getOnlineUserIds();
    const userPins = await dbGetUserPins(currentUserId);
    const isMuted = await dbIsMuted(currentUserId, conversation.id);
    const isArchived = await dbIsArchived(currentUserId, conversation.id);
    const isBlocked = await dbIsBlocked(currentUserId, target_user_id);

    return res.json({
      id: conversation.id,
      other_user: sanitizeUser(otherUser, onlineSet),
      last_message: conversation.last_message,
      last_message_at: conversation.last_message_at,
      unread_count: 0,
      is_pinned: userPins.some((p) => p.conversation_id === conversation.id),
      is_muted: isMuted,
      is_archived: isArchived,
      is_blocked: isBlocked,
    });
  });

  // Pin / Unpin Conversation (Max 3 pinned)
  app.post('/api/conversations/:id/pin', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { pin } = req.body; // boolean

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }

    try {
      const isPinned = await dbSetPin(currentUserId, convId, !!pin);
      return res.json({ success: true, is_pinned: isPinned });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao fixar conversa.' });
    }
  });

  // Archive / Unarchive Conversation
  app.post('/api/conversations/:id/archive', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { archive } = req.body;

    const isArchived = await dbToggleArchive(currentUserId, convId, archive);
    return res.json({ success: true, is_archived: isArchived });
  });

  // Mute / Unmute Conversation
  app.post('/api/conversations/:id/mute', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { mute } = req.body;

    const isMuted = await dbToggleMute(currentUserId, convId, mute);
    return res.json({ success: true, is_muted: isMuted });
  });

  // Block / Unblock User
  app.post('/api/users/:id/block', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const targetUserId = req.params.id;
    const { block } = req.body;

    const isBlocked = await dbToggleBlock(currentUserId, targetUserId, block);
    return res.json({ success: true, is_blocked: isBlocked });
  });

  // Toggle Read / Unread Status
  app.post('/api/conversations/:id/read-status', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { read } = req.body;

    const isUnread = await dbToggleManualUnread(currentUserId, convId, read === false ? true : false);
    return res.json({ success: true, unread_count: isUnread ? 1 : 0 });
  });

  // Clear Messages for a conversation
  app.delete('/api/conversations/:id/messages', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(403).json({ error: 'Acesso não permitido.' });
    }

    await dbClearConversationMessages(convId);
    return res.json({ success: true });
  });

  // Delete Conversation
  app.delete('/api/conversations/:id', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(403).json({ error: 'Acesso não permitido.' });
    }

    await dbDeleteConversation(currentUserId, convId);
    return res.json({ success: true });
  });

  // Get Messages for a conversation
  app.get('/api/conversations/:id/messages', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(403).json({ error: 'Você não tem permissão para ver esta conversa.' });
    }

    // Mark unread as read in Supabase
    await dbMarkMessagesAsRead(convId, currentUserId);

    const convMessages = await dbGetMessages(convId);
    const otherUserId = conv.user_1 === currentUserId ? conv.user_2 : conv.user_1;
    const otherUser = (await dbFindUserById(otherUserId)) || {
      id: otherUserId,
      username: 'desconhecido',
      profile_photo: DEFAULT_AVATARS[0],
      created_at: '',
      updated_at: '',
      last_seen: '',
      password_hash: '',
      salt: '',
    };

    broadcastToUser(otherUserId, {
      type: 'message:read',
      payload: { conversation_id: convId, reader_id: currentUserId },
    });

    return res.json({
      conversation_id: convId,
      other_user: sanitizeUser(otherUser),
      messages: convMessages,
    });
  });

  // Send Message HTTP endpoint
  app.post('/api/conversations/:id/messages', authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
    }

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(403).json({ error: 'Acesso não permitido.' });
    }

    const otherUserId = conv.user_1 === currentUserId ? conv.user_2 : conv.user_1;
    const msgId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const cleanText = message.trim();

    const newMsg: DbMessage = {
      id: msgId,
      conversation_id: convId,
      sender_id: currentUserId,
      receiver_id: otherUserId,
      message: cleanText,
      created_at: now,
      read: false,
    };

    // Save message to Supabase
    await dbCreateMessage(newMsg);
    // Update conversation last message in Supabase
    await dbUpdateConversationLastMessage(convId, cleanText, now, currentUserId);

    const senderUser = await dbFindUserById(currentUserId);

    // Broadcast to receiver
    broadcastToUser(otherUserId, {
      type: 'message:new',
      payload: {
        message: newMsg,
        conversation_id: convId,
        sender: senderUser ? sanitizeUser(senderUser) : { id: currentUserId, username: 'Usuário' },
      },
    });

    // Also broadcast to other sender tabs if any
    broadcastToUser(currentUserId, {
      type: 'message:new',
      payload: {
        message: newMsg,
        conversation_id: convId,
        sender: senderUser ? sanitizeUser(senderUser) : { id: currentUserId, username: 'Usuário' },
      },
    });

    return res.status(201).json({ message: newMsg });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), storage: 'supabase' });
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
    console.log(`Blá Blá Server with Supabase persistence running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
