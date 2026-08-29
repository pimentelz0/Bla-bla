import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://myoicywulrrzfohlsjfe.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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

// In-memory fallback cache only if Supabase tables haven't been run yet in the user's dashboard
// This guarantees the app never crashes if the user is in the process of running the SQL in Supabase
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

    if (!error && data) {
      return data as DbUser;
    }
  } catch (err) {
    console.error('Supabase find user error:', err);
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

    if (!error && data) {
      return data as DbUser;
    }
  } catch (err) {
    console.error('Supabase find user by id error:', err);
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

    if (!tokenErr && tokenData?.user_id) {
      return await dbFindUserById(tokenData.user_id);
    }
  } catch (err) {
    console.error('Supabase find user by token error:', err);
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

  try {
    const { error: userErr } = await supabase.from('users').insert([user]);
    if (userErr) {
      console.warn('Supabase insert user warning:', userErr.message);
    }
    const { error: tokErr } = await supabase.from('auth_tokens').insert([
      {
        token,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
    if (tokErr) {
      console.warn('Supabase insert token warning:', tokErr.message);
    }
  } catch (err) {
    console.error('Supabase create user error:', err);
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
      // Sync into memory cache
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
  archived: new Set<string>(), // `${userId}_${convId}`
  muted: new Set<string>(), // `${userId}_${convId}`
  blocked: new Set<string>(), // `${userId}_${blockedUserId}`
  deleted: new Set<string>(), // `${userId}_${convId}`
  manualUnread: new Set<string>(), // `${userId}_${convId}`
};

export async function dbDeleteConversation(userId: string, convId: string): Promise<void> {
  memoryUserPrefs.deleted.add(`${userId}_${convId}`);
  // Also delete all messages
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
