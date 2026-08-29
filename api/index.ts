import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
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
} from '../server/supabase';

function hashPassword(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

function sanitizeUser(u: {
  id: string;
  username: string;
  profile_photo: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
}) {
  return {
    id: u.id,
    username: u.username,
    profile_photo: u.profile_photo,
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_seen: u.last_seen,
    is_online: true,
  };
}

async function getAuthUser(req: any): Promise<{ user: DbUser; token: string } | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const user = await dbFindUserByToken(token);
  if (!user) return null;
  return { user, token };
}

function sendJson(res: any, statusCode: number, data: any) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

async function getParsedBody(req: any): Promise<any> {
  // If Vercel already parsed req.body
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }

  // If stream is already finished or not readable
  if (req.readableEnded || req.complete) {
    return {};
  }

  // Otherwise read stream safely
  return new Promise((resolve) => {
    let raw = '';
    const onData = (chunk: any) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        req.removeListener('data', onData);
        resolve({});
      }
    };
    req.on('data', onData);
    req.once('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.once('error', () => {
      resolve({});
    });
    // Safety timeout in case stream hangs
    setTimeout(() => {
      resolve({});
    }, 2000);
  });
}

function getQueryParam(req: any, param: string): string {
  try {
    if (req.query && req.query[param]) {
      return String(req.query[param]);
    }
    const fullUrl = req.url || '';
    const queryIdx = fullUrl.indexOf('?');
    if (queryIdx !== -1) {
      const sp = new URLSearchParams(fullUrl.substring(queryIdx));
      return sp.get(param) || '';
    }
  } catch {
    // fallback
  }
  return '';
}

function resolvePathname(req: any): string {
  // 1. Check path parameter from rewrite
  const pathParam = req.query?.path || getQueryParam(req, 'path');
  if (pathParam && typeof pathParam === 'string') {
    const clean = pathParam.replace(/^\/+/, '').replace(/\/+$/, '');
    return `/api/${clean}`;
  }

  // 2. Check x-matched-path or x-vercel-matched-path
  const matched = req.headers?.['x-matched-path'] || req.headers?.['x-vercel-matched-path'];
  if (typeof matched === 'string' && matched.length > 0) {
    const clean = matched.split('?')[0].replace(/\/+$/, '');
    if (clean.startsWith('/api')) return clean;
    return `/api${clean.startsWith('/') ? '' : '/'}${clean}`;
  }

  // 3. Check req.url
  const fullUrl = req.url || '';
  let pathname = fullUrl.split('?')[0].replace(/\/+$/, '') || '/api';
  if (!pathname.startsWith('/api')) {
    pathname = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }
  return pathname.replace(/\/+$/, '') || '/api';
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const pathname = resolvePathname(req);
  const method = (req.method || 'GET').toUpperCase();
  const body = await getParsedBody(req);

  try {
    // 1. Health check
    if (pathname === '/api/health' || pathname === '/api' || pathname === '/api/') {
      return sendJson(res, 200, { status: 'ok', time: new Date().toISOString(), storage: 'supabase' });
    }

    // 2. Supabase status
    if (pathname === '/api/supabase/status') {
      const status = await checkSupabaseConnection();
      return sendJson(res, 200, {
        supabase_url: SUPABASE_URL,
        connected: status.connected,
        tables_exist: status.tablesExist,
        error: status.error,
        schema_sql: SUPABASE_SQL_SCHEMA,
      });
    }

    // 3. Register
    if (pathname === '/api/auth/register' && method === 'POST') {
      let { username, pin, profile_photo } = body;
      if (!username || typeof username !== 'string') {
        return sendJson(res, 400, { error: 'Nome de usuário obrigatório.' });
      }

      username = username.trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return sendJson(res, 400, {
          error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _).',
        });
      }

      const existing = await dbFindUserByUsername(username);
      if (existing) {
        return sendJson(res, 400, { error: 'Esse nome de usuário já está sendo usado.' });
      }

      if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
        return sendJson(res, 400, { error: 'A senha deve conter exatamente 4 números.' });
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

      return sendJson(res, 201, {
        token,
        user: sanitizeUser(newUser),
      });
    }

    // 4. Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      let { username, pin } = body;
      if (!username || typeof username !== 'string') {
        return sendJson(res, 400, { error: 'Informe o nome de usuário.' });
      }
      if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
        return sendJson(res, 400, { error: 'A senha deve conter 4 dígitos.' });
      }

      username = username.trim().toLowerCase().replace(/^@/, '');
      const user = await dbFindUserByUsername(username);
      if (!user) {
        return sendJson(res, 400, { error: 'Usuário ou senha incorretos.' });
      }

      const testHash = hashPassword(pin.trim(), user.salt);
      if (testHash !== user.password_hash) {
        return sendJson(res, 400, { error: 'Usuário ou senha incorretos.' });
      }

      const now = new Date().toISOString();
      await dbUpdateUserLastSeen(user.id, now);
      user.last_seen = now;

      const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
      await dbSaveToken(token, user.id);

      return sendJson(res, 200, {
        token,
        user: sanitizeUser(user),
      });
    }

    // --- Authenticated routes below ---
    const auth = await getAuthUser(req);
    if (!auth) {
      return sendJson(res, 401, { error: 'Sessão expirada. Faça login novamente.' });
    }
    const { user, token } = auth;

    // 5. Get Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const now = new Date().toISOString();
      await dbUpdateUserLastSeen(user.id, now);
      user.last_seen = now;
      return sendJson(res, 200, { user: sanitizeUser(user) });
    }

    // 6. Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      await dbDeleteToken(token);
      return sendJson(res, 200, { success: true });
    }

    // 7. Update Profile
    if (pathname === '/api/auth/update_profile' && method === 'POST') {
      let { username, pin, profile_photo } = body;
      const updates: Partial<DbUser> = {};

      if (username && typeof username === 'string') {
        username = username.trim().toLowerCase().replace(/^@/, '');
        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
          return sendJson(res, 400, {
            error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _).',
          });
        }
        const existing = await dbFindUserByUsername(username);
        if (existing && existing.id !== user.id) {
          return sendJson(res, 400, { error: 'Esse nome de usuário já está sendo usado.' });
        }
        updates.username = username;
      }

      if (pin && typeof pin === 'string') {
        if (!/^\d{4}$/.test(pin.trim())) {
          return sendJson(res, 400, { error: 'A nova senha deve ter exatamente 4 números.' });
        }
        const newSalt = crypto.randomBytes(16).toString('hex');
        updates.salt = newSalt;
        updates.password_hash = hashPassword(pin.trim(), newSalt);
      }

      if (profile_photo && typeof profile_photo === 'string') {
        updates.profile_photo = profile_photo;
      }

      const updatedUser = await dbUpdateUser(user.id, updates);
      return sendJson(res, 200, { user: sanitizeUser(updatedUser || user) });
    }

    // 8. Search Users
    if (pathname === '/api/users/search' && method === 'GET') {
      const query = (getQueryParam(req, 'q') || '').trim().replace(/^@/, '');
      if (!query) {
        return sendJson(res, 200, { users: [] });
      }

      const users = await dbSearchUsers(user.id, query);
      const matches = users.map((u) => {
        const sorted = [user.id, u.id].sort();
        const convId = `c_${sorted[0]}_${sorted[1]}`;
        return {
          ...sanitizeUser(u),
          conversation_id: convId,
        };
      });

      return sendJson(res, 200, { users: matches });
    }

    // 9. Conversations (GET)
    if (pathname === '/api/conversations' && method === 'GET') {
      const userPins = await dbGetUserPins(user.id);
      const pinMap = new Map<string, number>();
      userPins.forEach((p) => pinMap.set(p.conversation_id, p.position));

      const conversations = await dbGetUserConversations(user.id);
      const summaries = await Promise.all(
        conversations.map(async (c) => {
          const otherUserId = c.user_1 === user.id ? c.user_2 : c.user_1;
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

          const unreadCount = await dbCountUnreadMessages(c.id, user.id);
          const isPinned = pinMap.has(c.id);
          const isMuted = await dbIsMuted(user.id, c.id);
          const isArchived = await dbIsArchived(user.id, c.id);
          const isBlocked = await dbIsBlocked(user.id, otherUserId);
          const isManualUnread = await dbIsManualUnread(user.id, c.id);

          return {
            id: c.id,
            other_user: sanitizeUser(otherUser),
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

      summaries.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        if (a.is_pinned && b.is_pinned) {
          return (a.pin_position ?? 0) - (b.pin_position ?? 0);
        }
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });

      return sendJson(res, 200, { conversations: summaries });
    }

    // 10. Open Conversation
    if (pathname === '/api/conversations/open' && method === 'POST') {
      const { target_user_id } = body;
      if (!target_user_id) {
        return sendJson(res, 400, { error: 'Usuário de destino inválido.' });
      }
      if (target_user_id === user.id) {
        return sendJson(res, 400, { error: 'Você não pode abrir conversa consigo mesmo.' });
      }

      const otherUser = await dbFindUserById(target_user_id);
      if (!otherUser) {
        return sendJson(res, 404, { error: 'Usuário não encontrado.' });
      }

      const conversation = await dbGetOrCreateConversation(user.id, target_user_id);
      const userPins = await dbGetUserPins(user.id);
      const isMuted = await dbIsMuted(user.id, conversation.id);
      const isArchived = await dbIsArchived(user.id, conversation.id);
      const isBlocked = await dbIsBlocked(user.id, target_user_id);

      return sendJson(res, 200, {
        id: conversation.id,
        other_user: sanitizeUser(otherUser),
        last_message: conversation.last_message,
        last_message_at: conversation.last_message_at,
        unread_count: 0,
        is_pinned: userPins.some((p) => p.conversation_id === conversation.id),
        is_muted: isMuted,
        is_archived: isArchived,
        is_blocked: isBlocked,
      });
    }

    // 11. Pin conversation (/api/conversations/:id/pin)
    const pinMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/pin$/);
    if (pinMatch && method === 'POST') {
      const convId = pinMatch[1];
      const { pin } = body;
      const isPinned = await dbSetPin(user.id, convId, !!pin);
      return sendJson(res, 200, { success: true, is_pinned: isPinned });
    }

    // 12. Archive conversation (/api/conversations/:id/archive)
    const archiveMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      const convId = archiveMatch[1];
      const { archive } = body;
      const isArchived = await dbToggleArchive(user.id, convId, archive);
      return sendJson(res, 200, { success: true, is_archived: isArchived });
    }

    // 13. Mute conversation (/api/conversations/:id/mute)
    const muteMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/mute$/);
    if (muteMatch && method === 'POST') {
      const convId = muteMatch[1];
      const { mute } = body;
      const isMuted = await dbToggleMute(user.id, convId, mute);
      return sendJson(res, 200, { success: true, is_muted: isMuted });
    }

    // 14. Block user (/api/users/:id/block)
    const blockMatch = pathname.match(/^\/api\/users\/([^/]+)\/block$/);
    if (blockMatch && method === 'POST') {
      const targetUserId = blockMatch[1];
      const { block } = body;
      const isBlocked = await dbToggleBlock(user.id, targetUserId, block);
      return sendJson(res, 200, { success: true, is_blocked: isBlocked });
    }

    // 15. Read status (/api/conversations/:id/read-status)
    const readMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/read-status$/);
    if (readMatch && method === 'POST') {
      const convId = readMatch[1];
      const { read } = body;
      const isUnread = await dbToggleManualUnread(user.id, convId, read === false ? true : false);
      return sendJson(res, 200, { success: true, unread_count: isUnread ? 1 : 0 });
    }

    // 16. Messages endpoint (GET / POST / DELETE)
    const messagesMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch) {
      const convId = messagesMatch[1];

      if (method === 'GET') {
        await dbMarkMessagesAsRead(convId, user.id);
        const conv = await dbGetConversationById(convId);
        const convMessages = await dbGetMessages(convId);
        const otherUserId = conv ? (conv.user_1 === user.id ? conv.user_2 : conv.user_1) : '';
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

        return sendJson(res, 200, {
          conversation_id: convId,
          other_user: sanitizeUser(otherUser),
          messages: convMessages,
        });
      }

      if (method === 'POST') {
        const { message } = body;
        if (!message || typeof message !== 'string' || !message.trim()) {
          return sendJson(res, 400, { error: 'Mensagem não pode ser vazia.' });
        }

        const conv = await dbGetConversationById(convId);
        if (!conv) {
          return sendJson(res, 404, { error: 'Conversa não encontrada.' });
        }

        const otherUserId = conv.user_1 === user.id ? conv.user_2 : conv.user_1;
        const msgId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();
        const cleanText = message.trim();

        const newMsg: DbMessage = {
          id: msgId,
          conversation_id: convId,
          sender_id: user.id,
          receiver_id: otherUserId,
          message: cleanText,
          created_at: now,
          read: false,
        };

        await dbCreateMessage(newMsg);
        await dbUpdateConversationLastMessage(convId, cleanText, now, user.id);

        return sendJson(res, 201, { message: newMsg });
      }

      if (method === 'DELETE') {
        await dbClearConversationMessages(convId);
        return sendJson(res, 200, { success: true });
      }
    }

    // 17. Delete conversation
    const deleteConvMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (deleteConvMatch && method === 'DELETE') {
      const convId = deleteConvMatch[1];
      await dbDeleteConversation(user.id, convId);
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 404, { error: 'Rota não encontrada: ' + pathname });
  } catch (err: any) {
    console.error('CREATE_ACCOUNT_ERROR / VERCEL_API_ERROR:', err);
    return sendJson(res, 500, { error: 'Não foi possível completar a solicitação. Tente novamente.' });
  }
}
