import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

console.log('[VERCEL_BOOT] api/index.ts loaded');
console.log('[VERCEL_BOOT] runtime initialized');
console.log('[VERCEL_BOOT] environment check', {
  hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
  hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
});

// ==========================================
// SUPABASE DATABASE LOGIC (INLINED FOR VERCEL)
// ==========================================

export const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://myoicywulrrzfohlsjfe.supabase.co'
).trim().replace(/\/+$/, '');

const serviceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  ''
).trim();

const anonKey = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn'
).trim();

export const SUPABASE_KEY = serviceRoleKey || anonKey;
export const IS_SERVICE_ROLE = !!serviceRoleKey;
export const KEY_TYPE = IS_SERVICE_ROLE ? 'service_role (Admin - Bypass RLS)' : 'anon (Public)';

let supabaseInstance: SupabaseClient | null = null;
try {
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} catch (bootErr: any) {
  console.error('[VERCEL_BOOT_ERROR] Failed to initialize Supabase client:', {
    name: bootErr?.name,
    message: bootErr?.message,
    stack: bootErr?.stack,
  });
}

export const supabase: SupabaseClient = supabaseInstance || (createClient('https://myoicywulrrzfohlsjfe.supabase.co', 'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn', {
  auth: { persistSession: false, autoRefreshToken: false },
}));

export class SupabaseDbError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  statusCode: number;

  constructor(message: string, code?: string, details?: string, hint?: string, statusCode = 500) {
    super(message);
    this.name = 'SupabaseDbError';
    this.code = code;
    this.details = details;
    this.hint = hint;
    this.statusCode = statusCode;
  }
}

export class SupabaseRLSError extends SupabaseDbError {
  constructor(tableName: string, operation: string, originalMessage: string, code = '42501') {
    const msg = `Bloqueado por Row-Level Security (RLS) no Supabase na tabela "${tableName}" durante operação de ${operation}. Para resolver: execute o script SQL com as políticas RLS no Supabase SQL Editor ou adicione a variável SUPABASE_SERVICE_ROLE_KEY na Vercel. (${originalMessage})`;
    super(msg, code, `Tabela: ${tableName}, Operação: ${operation}`, 'Execute o SQL de RLS no Supabase Dashboard ou configure SUPABASE_SERVICE_ROLE_KEY na Vercel', 403);
    this.name = 'SupabaseRLSError';
  }
}

export class SupabaseTableNotFoundError extends SupabaseDbError {
  constructor(tableName: string, originalMessage: string, code = 'PGRST205') {
    const msg = `Tabela "${tableName}" não existe no banco de dados Supabase (${SUPABASE_URL}). Execute o script SQL no Supabase SQL Editor para criar as tabelas. (${originalMessage})`;
    super(msg, code, `Tabela ausente: ${tableName}`, 'Copie e cole o schema SQL fornecido no SQL Editor do Supabase', 503);
    this.name = 'SupabaseTableNotFoundError';
  }
}

function parseSupabaseError(tableName: string, operation: string, err: any): SupabaseDbError {
  if (!err) return new SupabaseDbError('Erro desconhecido no banco de dados', 'UNKNOWN_DB_ERROR');
  const code = err.code || err.statusCode || '';
  const msg = err.message || String(err);
  const details = err.details || '';
  const hint = err.hint || '';

  if (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('violates row-level security policy') ||
    msg.toLowerCase().includes('permission denied')
  ) {
    return new SupabaseRLSError(tableName, operation, msg, code);
  }

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')) ||
    msg.toLowerCase().includes('could not find the table')
  ) {
    return new SupabaseTableNotFoundError(tableName, msg, code);
  }

  if (code === '23505' || msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique constraint')) {
    const dupErr = new SupabaseDbError(`Registro já existente (duplicado) na tabela "${tableName}".`, code, details || msg, hint, 400);
    dupErr.name = 'DuplicateRecordError';
    return dupErr;
  }

  return new SupabaseDbError(`Erro no Supabase (${tableName}/${operation}): ${msg}`, code, details, hint, 500);
}

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  profile_photo: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
}

export interface DbConversation {
  id: string;
  user_1: string;
  user_2: string;
  created_at: string;
  updated_at: string;
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read: boolean;
}

export interface DbPin {
  id?: string;
  user_id: string;
  conversation_id: string;
  position: number;
}

export interface DbAuthToken {
  token: string;
  user_id: string;
  created_at: string;
}

export const SUPABASE_SQL_SCHEMA = `CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_1 TEXT NOT NULL,
  user_2 TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_sender_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.pins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on users" ON public.users;
CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on conversations" ON public.conversations;
CREATE POLICY "Allow all on conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;
CREATE POLICY "Allow all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on pins" ON public.pins;
CREATE POLICY "Allow all on pins" ON public.pins FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on auth_tokens" ON public.auth_tokens;
CREATE POLICY "Allow all on auth_tokens" ON public.auth_tokens FOR ALL USING (true) WITH CHECK (true);
`;

const memoryFallback = {
  users: new Map<string, DbUser>(),
  conversations: new Map<string, DbConversation>(),
  messages: new Map<string, DbMessage>(),
  pins: new Map<string, DbPin>(),
  tokens: new Map<string, string>(),
};

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  tablesExist: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        return { connected: true, tablesExist: false, error: 'Tabelas ainda não criadas no Supabase' };
      }
      return { connected: false, tablesExist: false, error: error.message };
    }
    return { connected: true, tablesExist: true };
  } catch (err: any) {
    return { connected: false, tablesExist: false, error: err.message };
  }
}

export async function dbFindUserByUsername(username: string): Promise<DbUser | null> {
  const cleanUsername = username.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (error) {
      console.error('[SUPABASE_QUERY_ERROR] dbFindUserByUsername error:', error);
      throw parseSupabaseError('users', 'SELECT (find username)', error);
    }

    if (data) {
      memoryFallback.users.set(data.id, data as DbUser);
      return data as DbUser;
    }
  } catch (err: any) {
    if (err instanceof SupabaseDbError) {
      throw err;
    }
    console.error('Supabase find user exception:', err);
    throw parseSupabaseError('users', 'SELECT (find username)', err);
  }

  for (const u of memoryFallback.users.values()) {
    if (u.username.toLowerCase() === cleanUsername) return u;
  }
  return null;
}

export async function dbFindUserById(id: string): Promise<DbUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SUPABASE_QUERY_ERROR] dbFindUserById error:', error);
      throw parseSupabaseError('users', 'SELECT (find id)', error);
    }

    if (data) {
      memoryFallback.users.set(data.id, data as DbUser);
      return data as DbUser;
    }
  } catch (err: any) {
    if (err instanceof SupabaseDbError) throw err;
    console.error('Supabase find user by id exception:', err);
  }

  return memoryFallback.users.get(id) || null;
}

export async function dbFindUserByToken(token: string): Promise<DbUser | null> {
  try {
    const { data: tokenData, error: tokenErr } = await supabase
      .from('auth_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();

    if (tokenErr) {
      console.error('[SUPABASE_QUERY_ERROR] dbFindUserByToken error:', tokenErr);
      throw parseSupabaseError('auth_tokens', 'SELECT (find token)', tokenErr);
    }

    if (tokenData?.user_id) {
      return await dbFindUserById(tokenData.user_id);
    }
  } catch (err: any) {
    if (err instanceof SupabaseDbError) throw err;
    console.error('Supabase find user by token exception:', err);
  }

  const memoryUserId = memoryFallback.tokens.get(token);
  if (memoryUserId) {
    return memoryFallback.users.get(memoryUserId) || null;
  }
  return null;
}

export async function dbCreateUser(user: DbUser, token: string): Promise<void> {
  memoryFallback.users.set(user.id, user);
  memoryFallback.tokens.set(token, user.id);

  const { error: userErr } = await supabase.from('users').insert([user]);
  if (userErr) {
    console.error('[SUPABASE_INSERT_ERROR] Error inserting user into "users" table:', userErr);
    throw parseSupabaseError('users', 'INSERT', userErr);
  }

  const { error: tokErr } = await supabase.from('auth_tokens').insert([
    {
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
    },
  ]);
  if (tokErr) {
    console.error('[SUPABASE_INSERT_ERROR] Error inserting auth token into "auth_tokens" table:', tokErr);
    throw parseSupabaseError('auth_tokens', 'INSERT', tokErr);
  }
}

export async function dbUpdateUser(
  id: string,
  updates: Partial<DbUser>,
): Promise<DbUser | null> {
  const existing = await dbFindUserById(id);
  if (!existing) return null;

  const updated: DbUser = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  memoryFallback.users.set(id, updated);

  try {
    await supabase.from('users').update(updates).eq('id', id);
  } catch (err) {
    console.error('Supabase update user error:', err);
  }

  return updated;
}

export async function dbUpdateUserLastSeen(id: string, lastSeen: string): Promise<void> {
  const existing = memoryFallback.users.get(id);
  if (existing) {
    existing.last_seen = lastSeen;
  }

  try {
    await supabase.from('users').update({ last_seen: lastSeen }).eq('id', id);
  } catch (err) {
    // Non-blocking
  }
}

export async function dbSearchUsers(currentUserId: string, query: string): Promise<DbUser[]> {
  const clean = query.trim().toLowerCase();
  try {
    let q = supabase.from('users').select('*').neq('id', currentUserId);
    if (clean) {
      q = q.ilike('username', `%${clean}%`);
    }
    const { data, error } = await q.limit(50);
    if (!error && data) {
      for (const u of data) {
        memoryFallback.users.set(u.id, u);
      }
      return data as DbUser[];
    }
  } catch (err) {
    console.error('Supabase search users error:', err);
  }

  const results: DbUser[] = [];
  for (const u of memoryFallback.users.values()) {
    if (u.id !== currentUserId) {
      if (!clean || u.username.toLowerCase().includes(clean)) {
        results.push(u);
      }
    }
  }
  return results;
}

export async function dbGetConversationById(convId: string): Promise<DbConversation | null> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', convId)
      .maybeSingle();

    if (!error && data) {
      return data as DbConversation;
    }
  } catch (err) {
    console.error('Supabase get conv error:', err);
  }

  return memoryFallback.conversations.get(convId) || null;
}

export async function dbGetOrCreateConversation(
  user1Id: string,
  user2Id: string,
): Promise<DbConversation> {
  const sorted = [user1Id, user2Id].sort();
  const convId = `c_${sorted[0]}_${sorted[1]}`;

  const existing = await dbGetConversationById(convId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const newConv: DbConversation = {
    id: convId,
    user_1: sorted[0],
    user_2: sorted[1],
    created_at: now,
    updated_at: now,
    last_message: '',
    last_message_at: now,
    last_sender_id: '',
  };

  memoryFallback.conversations.set(convId, newConv);

  try {
    await supabase.from('conversations').insert([newConv]);
  } catch (err) {
    console.error('Supabase create conv error:', err);
  }

  return newConv;
}

export async function dbGetUserConversations(userId: string): Promise<DbConversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_1.eq.${userId},user_2.eq.${userId}`);

    if (!error && data) {
      for (const c of data) {
        memoryFallback.conversations.set(c.id, c);
      }
      return data as DbConversation[];
    }
  } catch (err) {
    console.error('Supabase get user convs error:', err);
  }

  const results: DbConversation[] = [];
  for (const c of memoryFallback.conversations.values()) {
    if (c.user_1 === userId || c.user_2 === userId) {
      results.push(c);
    }
  }
  return results;
}

export async function dbUpdateConversationLastMessage(
  convId: string,
  lastMessage: string,
  lastMessageAt: string,
  lastSenderId: string,
): Promise<void> {
  const conv = memoryFallback.conversations.get(convId);
  if (conv) {
    conv.last_message = lastMessage;
    conv.last_message_at = lastMessageAt;
    conv.last_sender_id = lastSenderId;
    conv.updated_at = lastMessageAt;
  }

  try {
    await supabase
      .from('conversations')
      .update({
        last_message: lastMessage,
        last_message_at: lastMessageAt,
        last_sender_id: lastSenderId,
        updated_at: lastMessageAt,
      })
      .eq('id', convId);
  } catch (err) {
    console.error('Supabase update conv error:', err);
  }
}

export async function dbGetMessages(convId: string): Promise<DbMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      for (const m of data) {
        memoryFallback.messages.set(m.id, m);
      }
      return data as DbMessage[];
    }
  } catch (err) {
    console.error('Supabase get messages error:', err);
  }

  const msgs: DbMessage[] = [];
  for (const m of memoryFallback.messages.values()) {
    if (m.conversation_id === convId) {
      msgs.push(m);
    }
  }
  msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return msgs;
}

export async function dbCreateMessage(msg: DbMessage): Promise<void> {
  memoryFallback.messages.set(msg.id, msg);

  try {
    const { error } = await supabase.from('messages').insert([msg]);
    if (error) {
      console.warn('Supabase insert message error:', error.message);
    }
  } catch (err) {
    console.error('Supabase create message error:', err);
  }
}

export async function dbMarkMessagesAsRead(convId: string, receiverId: string): Promise<void> {
  for (const m of memoryFallback.messages.values()) {
    if (m.conversation_id === convId && m.receiver_id === receiverId && !m.read) {
      m.read = true;
    }
  }

  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', convId)
      .eq('receiver_id', receiverId)
      .eq('read', false);
  } catch (err) {
    console.error('Supabase mark read error:', err);
  }
}

export async function dbCountUnreadMessages(convId: string, receiverId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', convId)
      .eq('receiver_id', receiverId)
      .eq('read', false);

    if (!error && count !== null) {
      return count;
    }
  } catch (err) {
    // Fallback below
  }

  let count = 0;
  for (const m of memoryFallback.messages.values()) {
    if (m.conversation_id === convId && m.receiver_id === receiverId && !m.read) {
      count++;
    }
  }
  return count;
}

export async function dbGetUserPins(userId: string): Promise<DbPin[]> {
  try {
    const { data, error } = await supabase
      .from('pins')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (!error && data) {
      for (const p of data) {
        memoryFallback.pins.set(`${p.user_id}_${p.conversation_id}`, p);
      }
      return data as DbPin[];
    }
  } catch (err) {
    console.error('Supabase get pins error:', err);
  }

  const results: DbPin[] = [];
  for (const p of memoryFallback.pins.values()) {
    if (p.user_id === userId) {
      results.push(p);
    }
  }
  results.sort((a, b) => a.position - b.position);
  return results;
}

export async function dbSetPin(userId: string, convId: string, pin: boolean): Promise<boolean> {
  const pinKey = `${userId}_${convId}`;
  const currentPins = await dbGetUserPins(userId);

  if (pin) {
    if (currentPins.some((p) => p.conversation_id === convId)) {
      return true;
    }
    if (currentPins.length >= 3) {
      throw new Error('Você pode fixar até 3 conversas.');
    }

    const newPin: DbPin = {
      id: `pin_${userId}_${convId}`,
      user_id: userId,
      conversation_id: convId,
      position: currentPins.length,
    };

    memoryFallback.pins.set(pinKey, newPin);

    try {
      await supabase.from('pins').upsert([newPin]);
    } catch (err) {
      console.error('Supabase set pin error:', err);
    }
    return true;
  } else {
    memoryFallback.pins.delete(pinKey);

    try {
      await supabase
        .from('pins')
        .delete()
        .eq('user_id', userId)
        .eq('conversation_id', convId);
    } catch (err) {
      console.error('Supabase delete pin error:', err);
    }

    const remaining = currentPins.filter((p) => p.conversation_id !== convId);
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i;
      memoryFallback.pins.set(`${userId}_${remaining[i].conversation_id}`, remaining[i]);
      try {
        await supabase
          .from('pins')
          .update({ position: i })
          .eq('user_id', userId)
          .eq('conversation_id', remaining[i].conversation_id);
      } catch (err) {
        // Continue
      }
    }
    return false;
  }
}

const memoryUserPrefs = {
  archived: new Set<string>(),
  muted: new Set<string>(),
  blocked: new Set<string>(),
  deleted: new Set<string>(),
  manualUnread: new Set<string>(),
};

export async function dbDeleteConversation(userId: string, convId: string): Promise<void> {
  memoryUserPrefs.deleted.add(`${userId}_${convId}`);
  await dbClearConversationMessages(convId);
  memoryFallback.conversations.delete(convId);

  try {
    await supabase.from('messages').delete().eq('conversation_id', convId);
    await supabase.from('conversations').delete().eq('id', convId);
  } catch (err) {
    console.error('Supabase delete conversation error:', err);
  }
}

export async function dbClearConversationMessages(convId: string): Promise<void> {
  for (const [key, msg] of memoryFallback.messages.entries()) {
    if (msg.conversation_id === convId) {
      memoryFallback.messages.delete(key);
    }
  }

  const conv = memoryFallback.conversations.get(convId);
  if (conv) {
    conv.last_message = '';
    conv.last_message_at = new Date().toISOString();
  }

  try {
    await supabase.from('messages').delete().eq('conversation_id', convId);
    await supabase.from('conversations').update({ last_message: '', last_message_at: new Date().toISOString() }).eq('id', convId);
  } catch (err) {
    console.error('Supabase clear messages error:', err);
  }
}

export async function dbToggleArchive(userId: string, convId: string, archive?: boolean): Promise<boolean> {
  const key = `${userId}_${convId}`;
  const shouldArchive = archive !== undefined ? archive : !memoryUserPrefs.archived.has(key);
  if (shouldArchive) {
    memoryUserPrefs.archived.add(key);
  } else {
    memoryUserPrefs.archived.delete(key);
  }
  return shouldArchive;
}

export async function dbIsArchived(userId: string, convId: string): Promise<boolean> {
  return memoryUserPrefs.archived.has(`${userId}_${convId}`);
}

export async function dbToggleMute(userId: string, convId: string, mute?: boolean): Promise<boolean> {
  const key = `${userId}_${convId}`;
  const shouldMute = mute !== undefined ? mute : !memoryUserPrefs.muted.has(key);
  if (shouldMute) {
    memoryUserPrefs.muted.add(key);
  } else {
    memoryUserPrefs.muted.delete(key);
  }
  return shouldMute;
}

export async function dbIsMuted(userId: string, convId: string): Promise<boolean> {
  return memoryUserPrefs.muted.has(`${userId}_${convId}`);
}

export async function dbToggleBlock(userId: string, targetUserId: string, block?: boolean): Promise<boolean> {
  const key = `${userId}_${targetUserId}`;
  const shouldBlock = block !== undefined ? block : !memoryUserPrefs.blocked.has(key);
  if (shouldBlock) {
    memoryUserPrefs.blocked.add(key);
  } else {
    memoryUserPrefs.blocked.delete(key);
  }
  return shouldBlock;
}

export async function dbIsBlocked(userId: string, targetUserId: string): Promise<boolean> {
  return memoryUserPrefs.blocked.has(`${userId}_${targetUserId}`);
}

export async function dbToggleManualUnread(userId: string, convId: string, unread?: boolean): Promise<boolean> {
  const key = `${userId}_${convId}`;
  const shouldUnread = unread !== undefined ? unread : !memoryUserPrefs.manualUnread.has(key);
  if (shouldUnread) {
    memoryUserPrefs.manualUnread.add(key);
  } else {
    memoryUserPrefs.manualUnread.delete(key);
  }
  return shouldUnread;
}

export async function dbIsManualUnread(userId: string, convId: string): Promise<boolean> {
  return memoryUserPrefs.manualUnread.has(`${userId}_${convId}`);
}

export async function dbSaveToken(token: string, userId: string): Promise<void> {
  memoryFallback.tokens.set(token, userId);

  try {
    await supabase.from('auth_tokens').insert([
      {
        token,
        user_id: userId,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error('Supabase save token error:', err);
  }
}

export async function dbDeleteToken(token: string): Promise<void> {
  memoryFallback.tokens.delete(token);

  try {
    await supabase.from('auth_tokens').delete().eq('token', token);
  } catch (err) {
    console.error('Supabase delete token error:', err);
  }
}

// ==========================================
// VERCEL SERVERLESS HANDLER
// ==========================================

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

  if (req.readableEnded || req.complete) {
    return {};
  }

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
  const pathParam = req.query?.path || getQueryParam(req, 'path');
  if (pathParam && typeof pathParam === 'string') {
    const clean = pathParam.replace(/^\/+/, '').replace(/\/+$/, '');
    return `/api/${clean}`;
  }

  const matched = req.headers?.['x-matched-path'] || req.headers?.['x-vercel-matched-path'];
  if (typeof matched === 'string' && matched.length > 0) {
    const clean = matched.split('?')[0].replace(/\/+$/, '');
    if (clean.startsWith('/api')) return clean;
    return `/api${clean.startsWith('/') ? '' : '/'}${clean}`;
  }

  const fullUrl = req.url || '';
  let pathname = fullUrl.split('?')[0].replace(/\/+$/, '') || '/api';
  if (!pathname.startsWith('/api')) {
    pathname = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }
  return pathname.replace(/\/+$/, '') || '/api';
}

export default async function handler(req: any, res: any) {
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
      const reqStartTime = new Date().toISOString();
      console.log(`[CREATE_ACCOUNT][STEP 1: REQ_START] Início da requisição às ${reqStartTime} via POST /api/auth/register (Vercel Serverless)`);

      try {
        let { username, pin, profile_photo } = body;
        console.log(`[CREATE_ACCOUNT][STEP 2: RECEIVED_DATA] Dados recebidos: username="${username || ''}", hasPin=${!!pin}, pinLength=${pin ? String(pin).length : 0}, hasAvatar=${!!profile_photo}`);

        if (!username || typeof username !== 'string') {
          console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] Nome de usuário ausente.`);
          return sendJson(res, 400, {
            error: 'Nome de usuário obrigatório.',
            error_name: 'ValidationError',
            code: 'USERNAME_REQUIRED',
          });
        }

        username = username.trim().toLowerCase().replace(/^@/, '');
        console.log(`[CREATE_ACCOUNT][STEP 3: VALIDATE_USERNAME] Validando username "${username}"...`);

        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
          console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] Formato inválido para username "${username}".`);
          return sendJson(res, 400, {
            error: 'O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _).',
            error_name: 'ValidationError',
            code: 'INVALID_USERNAME_FORMAT',
          });
        }

        console.log(`[CREATE_ACCOUNT][STEP 4: VALIDATE_PIN] Validando senha/PIN...`);
        if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
          console.warn(`[CREATE_ACCOUNT][VALIDATION_FAILED] PIN não contém exatamente 4 dígitos.`);
          return sendJson(res, 400, {
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
          return sendJson(res, 400, {
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

        return sendJson(res, 201, {
          token,
          user: sanitizeUser(newUser),
        });
      } catch (regErr: any) {
        console.error("CREATE_ACCOUNT_ERROR", {
          name: regErr?.name || 'Error',
          message: regErr?.message || String(regErr),
          code: regErr?.code || (regErr as any)?.statusCode || 'INTERNAL_ERROR',
          details: regErr?.details || null,
          hint: regErr?.hint || null,
          stack: regErr?.stack,
        });

        const statusCode = (regErr as any)?.statusCode || 500;
        return sendJson(res, statusCode, {
          error: regErr?.message || 'Erro ao criar conta.',
          error_name: regErr?.name || 'CreateAccountError',
          code: regErr?.code || 'ERROR_UNKNOWN',
          details: regErr?.details || null,
          hint: regErr?.hint || null,
        });
      }
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
    console.error('VERCEL_API_ERROR:', {
      name: err?.name || 'Error',
      message: err?.message || String(err),
      code: err?.code || (err as any)?.statusCode,
      details: err?.details,
      hint: err?.hint,
      stack: err?.stack,
    });
    const statusCode = (err as any)?.statusCode || 500;
    return sendJson(res, statusCode, {
      error: err?.message || 'Erro no processamento da solicitação.',
      error_name: err?.name || 'ServerError',
      code: err?.code || 'ERROR_INTERNAL',
      details: err?.details || null,
      hint: err?.hint || null,
    });
  }
}
