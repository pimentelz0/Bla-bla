import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://myoicywulrrzfohlsjfe.supabase.co'
).trim().replace(/\/+$/, '');

// Prioritize Service Role Key on backend (bypasses RLS safely on server) if provided, otherwise Anon Key
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

// Fallback proxy or instance to prevent top-level module crash
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

  // RLS violation codes (42501, PGRST301, permission denied, row-level security)
  if (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('violates row-level security policy') ||
    msg.toLowerCase().includes('permission denied')
  ) {
    return new SupabaseRLSError(tableName, operation, msg, code);
  }

  // Missing table codes (PGRST205, 42P01, relation does not exist, could not find the table)
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')) ||
    msg.toLowerCase().includes('could not find the table')
  ) {
    return new SupabaseTableNotFoundError(tableName, msg, code);
  }

  // Duplicate key (23505)
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

export const SUPABASE_SQL_SCHEMA = `-- Copie e cole este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/myoicywulrrzfohlsjfe/sql/new

CREATE TABLE IF NOT EXISTS public.users (
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

-- Políticas RLS para acesso público via Chave Anon
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

-- Habilitar Realtime para mensagens
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

// In-memory fallback cache
const memoryFallback = {
  users: new Map<string, DbUser>(),
  conversations: new Map<string, DbConversation>(),
  messages: new Map<string, DbMessage>(),
  pins: new Map<string, DbPin>(),
  tokens: new Map<string, string>(),
};

let supabaseTablesVerified = false;

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  tablesExist: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        supabaseTablesVerified = false;
        return { connected: true, tablesExist: false, error: 'Tabelas ainda não criadas no Supabase' };
      }
      return { connected: false, tablesExist: false, error: error.message };
    }
    supabaseTablesVerified = true;
    return { connected: true, tablesExist: true };
  } catch (err: any) {
    return { connected: false, tablesExist: false, error: err.message };
  }
}

// User methods
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

  // Memory fallback check
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

  // Fallback to memory
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

export async function dbGetAllUsers(): Promise<DbUser[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data) {
      for (const u of data) {
        memoryFallback.users.set(u.id, u);
      }
      return data as DbUser[];
    }
  } catch (err) {
    console.error('Supabase get all users error:', err);
  }
  return Array.from(memoryFallback.users.values());
}

// Conversation methods
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

// Message methods
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

// Pins
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

    // Reorder remaining
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

// Conversation Settings & Actions
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

// Token methods
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
