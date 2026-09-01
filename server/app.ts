import express from 'express';
import crypto from 'crypto';
import {
  DbUser,
  DbConversation,
  DbMessage,
  DbPin,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_URL,
  KEY_TYPE,
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
  dbFindUsersByIds,
  dbGetBatchUnreadCounts,
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
  dbSavePushSubscription,
  dbDeletePushSubscription,
  dbMarkMessagesAsDelivered,
  dbMarkConversationDelivered,
} from './supabase';
import { getVapidPublicKey, sendWebPushToUser } from './webPush';
import { INVENTED_EMOJIS } from '../src/utils/customAvatars';

function hashPassword(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('hex');
}

const DEFAULT_AVATARS = INVENTED_EMOJIS.map((e) => e.url);

export function isUserOnline(lastSeenIso?: string, onlineSet?: Set<string>, userId?: string): boolean {
  if (onlineSet && userId && onlineSet.has(userId)) return true;
  if (!lastSeenIso) return false;
  const ts = new Date(lastSeenIso).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts < 45 * 1000;
}

export function sanitizeUser(
  u: { id: string; username: string; profile_photo: string; created_at: string; updated_at: string; last_seen: string },
  onlineSet?: Set<string>,
) {
  return {
    id: u.id,
    username: u.username,
    profile_photo: u.profile_photo,
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_seen: u.last_seen,
    is_online: isUserOnline(u.last_seen, onlineSet, u.id),
  };
}

export function createExpressApp(
  options: {
    getOnlineUserIds?: () => Set<string>;
    broadcastToUser?: (userId: string, data: any) => void;
  } = {},
) {
  const { getOnlineUserIds = () => new Set<string>(), broadcastToUser = () => {} } = options;

  const app = express();

  // URL normalization for Vercel rewrites and Serverless
  app.use((req, res, next) => {
    // 1. Check x-matched-path header from Vercel
    const matchedPath = (req.headers['x-matched-path'] as string) || (req.headers['x-vercel-matched-path'] as string);
    // 2. Check path query parameter
    const pathQuery = req.query?.path as string;

    if (pathQuery) {
      req.url = `/api/${pathQuery.replace(/^\/+/, '')}`;
    } else if (matchedPath && matchedPath.startsWith('/api')) {
      req.url = matchedPath.split('?')[0];
    }
    next();
  });

  // CORS and body parser
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // --- Supabase Status & Schema Endpoint ---
  app.get(['/api/supabase/status', '/supabase/status'], async (req, res) => {
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
  app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
    const reqStartTime = new Date().toISOString();
    console.log(`[CREATE_ACCOUNT][STEP 1: REQ_START] Início da requisição às ${reqStartTime} via POST ${req.url}`);

    try {
      let { username, pin, profile_photo } = req.body || {};

      console.log(`[CREATE_ACCOUNT][STEP 2: RECEIVED_DATA] Dados recebidos: username="${username || ''}", hasPin=${!!pin}, pinLength=${pin ? String(pin).length : 0}, hasAvatar=${!!profile_photo}`);

      if (!username || typeof username !== 'string') {
        console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] Username ausente.`);
        return res.status(400).json({
          error: 'Nome de usuário obrigatório.',
          error_name: 'ValidationError',
          code: 'USERNAME_REQUIRED',
        });
      }

      username = username.trim().toLowerCase().replace(/^@/, '');
      console.log(`[CREATE_ACCOUNT][STEP 3: VALIDATE_USERNAME] Validando username "${username}"...`);

      // Validate username: 3-20 characters, letters, numbers, underscores only
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] Formato inválido para username "${username}".`);
        return res.status(400).json({
          error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _ sem espaços).',
          error_name: 'ValidationError',
          code: 'INVALID_USERNAME_FORMAT',
        });
      }

      console.log(`[CREATE_ACCOUNT][STEP 4: VALIDATE_PIN] Validando senha/PIN...`);
      // Validate PIN: exactly 4 numeric digits
      if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
        console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] PIN não contém exatamente 4 dígitos.`);
        return res.status(400).json({
          error: 'A senha deve conter exatamente 4 números.',
          error_name: 'ValidationError',
          code: 'INVALID_PIN_FORMAT',
        });
      }

      console.log(`[CREATE_ACCOUNT][STEP 5: HASH_PIN] Gerando salt seguro e hash PBKDF2...`);
      const salt = crypto.randomBytes(16).toString('hex');
      const password_hash = hashPassword(pin.trim(), salt);

      console.log(`[CREATE_ACCOUNT][STEP 6: DB_CONNECT] Conectando ao Supabase (${SUPABASE_URL}) [Tipo de chave: ${KEY_TYPE}]...`);

      console.log(`[CREATE_ACCOUNT][STEP 7: CHECK_DUPLICATE] Verificando se username "${username}" já existe no banco...`);
      const existing = await dbFindUserByUsername(username);
      if (existing) {
        console.warn(`[CREATE_ACCOUNT][DUPLICATE_USERNAME] Username "${username}" já em uso.`);
        return res.status(400).json({
          error: 'Esse nome de usuário já está sendo usado.',
          error_name: 'DuplicateUserError',
          code: 'USER_ALREADY_EXISTS',
        });
      }

      if (!profile_photo || typeof profile_photo !== 'string') {
        const randIndex = Math.floor(Math.random() * DEFAULT_AVATARS.length);
        profile_photo = DEFAULT_AVATARS[randIndex];
      }
      console.log(`[CREATE_ACCOUNT][STEP 9: SAVE_AVATAR] Avatar atribuído com sucesso.`);

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

      console.log(`[CREATE_ACCOUNT][STEP 8: CREATE_USER] Inserindo novo usuário id="${userId}" no Supabase...`);
      await dbCreateUser(newUser, token);

      console.log(`[CREATE_ACCOUNT][STEP 10: SEND_RESPONSE] Conta criada com sucesso para @${username} (id: ${userId}). Resposta 201 enviada.`);

      return res.status(201).json({
        token,
        user: sanitizeUser(newUser, getOnlineUserIds()),
      });
    } catch (err: any) {
      console.error("CREATE_ACCOUNT_ERROR", {
        name: err?.name || 'Error',
        message: err?.message || String(err),
        code: err?.code || (err as any)?.statusCode || 'INTERNAL_ERROR',
        details: err?.details || null,
        hint: err?.hint || null,
        stack: err?.stack,
      });

      const statusCode = (err as any)?.statusCode || 500;
      return res.status(statusCode).json({
        error: err?.message || 'Erro ao criar conta.',
        error_name: err?.name || 'CreateAccountError',
        code: err?.code || 'ERROR_UNKNOWN',
        details: err?.details || null,
        hint: err?.hint || null,
      });
    }
  });

  app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
    try {
      let { username, pin } = req.body || {};

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
        user: sanitizeUser(user, getOnlineUserIds()),
      });
    } catch (err: any) {
      console.error("LOGIN_ERROR:", err);
      return res.status(500).json({ error: 'Erro ao efetuar login. Tente novamente.' });
    }
  });

  app.get(['/api/auth/me', '/auth/me'], authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    const now = new Date().toISOString();
    await dbUpdateUserLastSeen(user.id, now);
    user.last_seen = now;
    return res.json({ user: sanitizeUser(user, getOnlineUserIds()) });
  });

  app.post(['/api/auth/heartbeat', '/auth/heartbeat'], authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    const now = new Date().toISOString();
    await dbUpdateUserLastSeen(user.id, now);
    user.last_seen = now;
    return res.json({ success: true, last_seen: now });
  });

  app.post(['/api/auth/offline', '/auth/offline'], authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    const oldTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    await dbUpdateUserLastSeen(user.id, oldTime);
    user.last_seen = oldTime;
    return res.json({ success: true });
  });

  app.post(['/api/auth/logout', '/auth/logout'], authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    const token = (req as any).token as string;
    if (user?.id) {
      const oldTime = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      await dbUpdateUserLastSeen(user.id, oldTime);
    }
    await dbDeleteToken(token);
    return res.json({ success: true });
  });

  app.post(['/api/auth/update_profile', '/auth/update_profile'], authenticate, async (req, res) => {
    const user = (req as any).user as DbUser;
    let { username, pin, profile_photo } = req.body || {};

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
    return res.json({ user: sanitizeUser(updatedUser || user, getOnlineUserIds()) });
  });

  // --- Users Search Route ---
  app.get(['/api/users/search', '/users/search'], authenticate, async (req, res) => {
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
  app.get(['/api/conversations', '/conversations'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const onlineSet = getOnlineUserIds();

    const [userPins, conversations, unreadMap] = await Promise.all([
      dbGetUserPins(currentUserId),
      dbGetUserConversations(currentUserId),
      dbGetBatchUnreadCounts(currentUserId),
    ]);

    const pinMap = new Map<string, number>();
    userPins.forEach((p) => pinMap.set(p.conversation_id, p.position));

    // Batch fetch all other users in a single operation
    const otherUserIds = conversations.map((c) => (c.user_1 === currentUserId ? c.user_2 : c.user_1));
    const userMap = await dbFindUsersByIds(otherUserIds);

    const summaries = await Promise.all(
      conversations.map(async (c) => {
        const otherUserId = c.user_1 === currentUserId ? c.user_2 : c.user_1;
        const otherUser = userMap.get(otherUserId) || {
          id: otherUserId,
          username: 'desconhecido',
          profile_photo: DEFAULT_AVATARS[0],
          created_at: '',
          updated_at: '',
          last_seen: '',
          password_hash: '',
          salt: '',
        };

        const unreadCount = unreadMap.get(c.id) || 0;
        const isPinned = pinMap.has(c.id);
        const isMuted = await dbIsMuted(currentUserId, c.id);
        const isArchived = await dbIsArchived(currentUserId, c.id);
        const isBlocked = await dbIsBlocked(currentUserId, otherUserId);
        const isManualUnread = await dbIsManualUnread(currentUserId, c.id);

        // Sanitize legacy last_message if it contains raw Base64 media data
        let cleanLastMessage = c.last_message || '';
        if (cleanLastMessage.includes('data:image/') || cleanLastMessage.includes('data:audio/') || cleanLastMessage.length > 500) {
          try {
            if (cleanLastMessage.startsWith('{') && cleanLastMessage.endsWith('}')) {
              const parsed = JSON.parse(cleanLastMessage);
              if (parsed.type === 'image') cleanLastMessage = parsed.caption ? `📷 Foto • ${parsed.caption}` : '📷 Foto';
              else if (parsed.type === 'audio') cleanLastMessage = '🎤 Áudio';
              else if (parsed.type === 'sticker') cleanLastMessage = '🎭 Figurinha';
            } else if (cleanLastMessage.startsWith('[IMG]')) {
              cleanLastMessage = '📷 Foto';
            } else if (cleanLastMessage.startsWith('[AUDIO]')) {
              cleanLastMessage = '🎤 Áudio';
            } else if (cleanLastMessage.startsWith('[STICKER]')) {
              cleanLastMessage = '🎭 Figurinha';
            } else {
              cleanLastMessage = cleanLastMessage.substring(0, 150) + '...';
            }
          } catch {
            cleanLastMessage = '📷 Foto';
          }
        }

        return {
          id: c.id,
          other_user: sanitizeUser(otherUser, onlineSet),
          last_message: cleanLastMessage,
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

  app.post(['/api/conversations/open', '/conversations/open'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const { target_user_id } = req.body || {};

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
  app.post(['/api/conversations/:id/pin', '/conversations/:id/pin'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { pin } = req.body || {};

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
  app.post(['/api/conversations/:id/archive', '/conversations/:id/archive'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { archive } = req.body || {};

    const isArchived = await dbToggleArchive(currentUserId, convId, archive);
    return res.json({ success: true, is_archived: isArchived });
  });

  // Mute / Unmute Conversation
  app.post(['/api/conversations/:id/mute', '/conversations/:id/mute'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { mute } = req.body || {};

    const isMuted = await dbToggleMute(currentUserId, convId, mute);
    return res.json({ success: true, is_muted: isMuted });
  });

  // Block / Unblock User
  app.post(['/api/users/:id/block', '/users/:id/block'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const targetUserId = req.params.id;
    const { block } = req.body || {};

    const isBlocked = await dbToggleBlock(currentUserId, targetUserId, block);
    return res.json({ success: true, is_blocked: isBlocked });
  });

  // Toggle Read / Unread Status
  app.post(['/api/conversations/:id/read-status', '/conversations/:id/read-status'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { read } = req.body || {};

    const isUnread = await dbToggleManualUnread(currentUserId, convId, read === false ? true : false);
    return res.json({ success: true, unread_count: isUnread ? 1 : 0 });
  });

  // Clear Messages for a conversation
  app.delete(['/api/conversations/:id/messages', '/conversations/:id/messages'], authenticate, async (req, res) => {
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
  app.delete(['/api/conversations/:id', '/conversations/:id'], authenticate, async (req, res) => {
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
  app.get(['/api/conversations/:id/messages', '/conversations/:id/messages'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 50;

    const conv = await dbGetConversationById(convId);
    if (!conv || (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId)) {
      return res.status(403).json({ error: 'Você não tem permissão para ver esta conversa.' });
    }

    // Mark unread as read in Supabase when loading initial conversation or full view
    if (!since) {
      await dbMarkMessagesAsRead(convId, currentUserId);
    }

    const convMessages = await dbGetMessages(convId, { since, limit });
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

    if (!since) {
      broadcastToUser(otherUserId, {
        type: 'message:read',
        payload: { conversation_id: convId, reader_id: currentUserId },
      });
    }

    return res.json({
      conversation_id: convId,
      other_user: sanitizeUser(otherUser, getOnlineUserIds()),
      messages: convMessages,
    });
  });

  // Send Message HTTP endpoint
  app.post(['/api/conversations/:id/messages', '/conversations/:id/messages'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const convId = req.params.id;
    const { message, receiver_id } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
    }

    let conv = await dbGetConversationById(convId);
    let otherUserId: string | null = receiver_id || null;

    if (conv) {
      if (conv.user_1 !== currentUserId && conv.user_2 !== currentUserId) {
        return res.status(403).json({ error: 'Acesso não permitido.' });
      }
      if (!otherUserId) {
        otherUserId = conv.user_1 === currentUserId ? conv.user_2 : conv.user_1;
      }
    } else {
      // Synthetic conversation ID fallback (e.g. c_u_user1_u_user2)
      if (convId.startsWith('c_u_')) {
        const parts = convId.substring(2).split('_u_');
        if (parts.length === 2) {
          const u1 = `u_${parts[0].replace(/^u_/, '')}`;
          const u2 = `u_${parts[1]}`;
          if (u1 === currentUserId || u2 === currentUserId) {
            otherUserId = otherUserId || (u1 === currentUserId ? u2 : u1);
          }
        }
      }
    }

    if (!otherUserId) {
      return res.status(400).json({ error: 'Destinatário não identificado para esta conversa.' });
    }

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

    // Extract lightweight summary for last_message to prevent storing large Base64 in conversations table
    let lastMessageSummary = cleanText;
    try {
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        const parsed = JSON.parse(cleanText);
        if (parsed.type === 'image') {
          lastMessageSummary = parsed.caption ? `📷 Foto • ${parsed.caption}` : '📷 Foto';
        } else if (parsed.type === 'audio') {
          const dur = parsed.duration ? `${Math.floor(parsed.duration / 60)}:${Math.floor(parsed.duration % 60).toString().padStart(2, '0')}` : '';
          lastMessageSummary = dur ? `🎤 Áudio (${dur})` : '🎤 Áudio';
        } else if (parsed.type === 'sticker') {
          lastMessageSummary = '🎭 Figurinha';
        }
      } else if (cleanText.startsWith('[IMG]')) {
        lastMessageSummary = '📷 Foto';
      } else if (cleanText.startsWith('[AUDIO]')) {
        lastMessageSummary = '🎤 Áudio';
      } else if (cleanText.startsWith('[STICKER]')) {
        lastMessageSummary = '🎭 Figurinha';
      }
    } catch {}

    if (lastMessageSummary.length > 200) {
      lastMessageSummary = lastMessageSummary.substring(0, 197) + '...';
    }

    // 1. Save message to Supabase messages table
    await dbCreateMessage(newMsg);
    // 2. Update conversation with lightweight summary in Supabase
    await dbUpdateConversationLastMessage(convId, lastMessageSummary, now, currentUserId);

    const senderUser = await dbFindUserById(currentUserId);
    const onlineSet = getOnlineUserIds();
    const isReceiverOnline = onlineSet.has(otherUserId);

    if (isReceiverOnline) {
      newMsg.delivered = true;
      await dbMarkMessagesAsDelivered([msgId]);
    }

    // Broadcast to receiver
    broadcastToUser(otherUserId, {
      type: 'message:new',
      payload: {
        message: newMsg,
        conversation_id: convId,
        sender: senderUser ? sanitizeUser(senderUser, onlineSet) : { id: currentUserId, username: 'Usuário' },
      },
    });

    // Also broadcast to sender
    broadcastToUser(currentUserId, {
      type: 'message:new',
      payload: {
        message: newMsg,
        conversation_id: convId,
        sender: senderUser ? sanitizeUser(senderUser, onlineSet) : { id: currentUserId, username: 'Usuário' },
      },
    });

    // 2. Format Web Push payload
    let pushPreview = cleanText;
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed.type === 'image') pushPreview = '📷 Foto' + (parsed.content ? `: ${parsed.content}` : '');
      else if (parsed.type === 'audio') pushPreview = '🎤 Mensagem de voz';
      else if (parsed.type === 'sticker') pushPreview = '🎭 Figurinha';
    } catch {}

    const senderName = senderUser?.username ? `@${senderUser.username}` : 'Blá Blá';
    const pushPayload = {
      title: senderName,
      body: pushPreview,
      icon: senderUser?.profile_photo || '/icon-192.png',
      badge: '/icon-192.png',
      tag: `chat_${convId}`,
      data: {
        conversationId: convId,
        messageId: msgId,
        senderId: currentUserId,
        timestamp: Date.now(),
      },
    };

    // 3. AWAIT Web Push dispatch so Vercel Serverless Function does not freeze execution before gateway delivery
    try {
      // Use Promise.race with a 3-second ceiling so API responds quickly even if external push gateway is sluggish
      const pushPromise = sendWebPushToUser(otherUserId, pushPayload, broadcastToUser);
      const timeoutPromise = new Promise<{ sentCount: number; errors: number }>((resolve) =>
        setTimeout(() => resolve({ sentCount: 0, errors: 0 }), 3000)
      );

      const pushResult = await Promise.race([pushPromise, timeoutPromise]);
      const totalSubscriptions = pushResult.sentCount + pushResult.errors;
      const pushDispatchStatus = pushResult.sentCount > 0 ? 'success' : totalSubscriptions === 0 ? 'no_subscriptions' : 'failed';
      console.log(`[Push Message]\nsenderId: ${currentUserId}\nreceiverId: ${otherUserId}\nsubscriptionsFound: ${totalSubscriptions}\npushDispatch: ${pushDispatchStatus}`);
    } catch (pushErr) {
      console.error(`[Push Message]\nsenderId: ${currentUserId}\nreceiverId: ${otherUserId}\npushDispatch: error`, pushErr);
    }

    // 5. Return message response normally
    return res.status(201).json({ message: newMsg });
  });

  // Get VAPID Public Key for Web Push subscription
  app.get(['/api/push/vapid-public-key', '/push/vapid-public-key'], (req, res) => {
    return res.json({ publicKey: getVapidPublicKey() });
  });

  // Save Push Subscription
  app.post(['/api/push/subscribe', '/push/subscribe'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const { subscription } = req.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Inscrição Push inválida.' });
    }

    try {
      await dbSavePushSubscription({
        userId: currentUserId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
      console.log(`[Push Subscribe]\nuserId: ${currentUserId}\nsubscriptionSaved: true`);
      return res.json({ success: true, result: 'created/updated' });
    } catch (err: any) {
      console.error(`[Push Subscribe]\nuserId: ${currentUserId}\nsubscriptionSaved: false`, err);
      return res.status(500).json({ error: 'Erro ao registrar notificações Push.' });
    }
  });

  // Schedule real server test push after delay (to allow user to minimize/lock phone)
  app.post(['/api/push/test', '/push/test'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const currentUser = (req as any).user as DbUser;
    const { delayMs = 3000 } = req.body || {};

    setTimeout(async () => {
      try {
        console.log(`[TEST_PUSH] Triggering scheduled server push for ${currentUserId}`);
        await sendWebPushToUser(
          currentUserId,
          {
            title: `@${currentUser.username || 'blabla_chat'}`,
            body: '🔔 Teste de notificação com app fechado funcionando 100%!',
            icon: currentUser.profile_photo || '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'test_push_server',
            data: {
              timestamp: Date.now(),
            },
          },
          broadcastToUser,
        );
      } catch (err) {
        console.error('[TEST_PUSH_ERROR]', err);
      }
    }, Math.max(500, Math.min(10000, Number(delayMs) || 3000)));

    return res.json({ success: true, message: 'Notificação push agendada no servidor' });
  });

  // Unsubscribe Push
  app.post(['/api/push/unsubscribe', '/push/unsubscribe'], authenticate, async (req, res) => {
    const { endpoint } = req.body || {};
    if (endpoint) {
      await dbDeletePushSubscription(endpoint);
    }
    return res.json({ success: true });
  });

  // Mark message as delivered acknowledgment
  app.post(['/api/messages/delivered', '/messages/delivered'], authenticate, async (req, res) => {
    const currentUserId = ((req as any).user as DbUser).id;
    const { messageId, conversationId } = req.body || {};

    if (messageId) {
      await dbMarkMessagesAsDelivered([messageId]);
    } else if (conversationId) {
      await dbMarkConversationDelivered(conversationId, currentUserId);
    }

    if (conversationId) {
      const conv = await dbGetConversationById(conversationId);
      if (conv) {
        const otherUserId = conv.user_1 === currentUserId ? conv.user_2 : conv.user_1;
        broadcastToUser(otherUserId, {
          type: 'message:delivered',
          payload: { conversation_id: conversationId, message_id: messageId },
        });
      }
    }

    return res.json({ success: true });
  });

  // Health check - only API prefixes, do NOT match '/'
  app.get(['/api/health', '/health', '/api'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), storage: 'supabase' });
  });

  // Global error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER_UNHANDLED_ERROR:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno no servidor. Tente novamente.' });
    }
  });

  return app;
}
