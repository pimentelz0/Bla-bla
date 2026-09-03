import { User, Message, ConversationSummary, SearchUserResult, AuthResponse } from '../types';

const TOKEN_KEY = 'bla_bla_token';
const USER_KEY = 'bla_bla_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Falha na conexão com o servidor. Verifique sua internet.');
  }

  let data: any = null;
  try {
    const rawText = await response.text();
    if (rawText) {
      data = JSON.parse(rawText);
    }
  } catch {
    // not valid JSON
  }

  if (!response.ok) {
    const errorPrefix = data?.error_name ? `[${data.error_name}${data.code ? `: ${data.code}` : ''}] ` : '';
    const mainMsg = data?.error || (response.status === 404 ? 'Serviço temporariamente indisponível (404).' : `Erro HTTP ${response.status}`);
    const detailsMsg = data?.details && data.details !== data.error ? ` (${data.details})` : '';
    const hintMsg = data?.hint ? `\n💡 Dica: ${data.hint}` : '';
    throw new Error(`${errorPrefix}${mainMsg}${detailsMsg}${hintMsg}`);
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export const api = {
  async register(username: string, pin: string, profilePhoto?: string): Promise<AuthResponse> {
    const res = await fetchWithAuth<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, pin, profile_photo: profilePhoto }),
    });
    if (!res || !res.user || !res.token) {
      throw new Error('Não foi possível completar o cadastro: resposta vazia do servidor.');
    }
    setStoredAuth(res.token, res.user);
    return res;
  },

  async login(username: string, pin: string): Promise<AuthResponse> {
    const res = await fetchWithAuth<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
    if (!res || !res.user || !res.token) {
      throw new Error('Usuário ou senha incorretos.');
    }
    setStoredAuth(res.token, res.user);
    return res;
  },

  async getMe(): Promise<User> {
    const res = await fetchWithAuth<{ user: User }>('/api/auth/me');
    if (res?.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      return res.user;
    }
    throw new Error('Não foi possível obter os dados do usuário.');
  },

  async heartbeat(): Promise<{ success: boolean; last_seen?: string }> {
    try {
      return await fetchWithAuth<{ success: boolean; last_seen?: string }>('/api/auth/heartbeat', {
        method: 'POST',
      });
    } catch {
      return { success: false };
    }
  },

  async setOffline(): Promise<void> {
    try {
      await fetchWithAuth('/api/auth/offline', { method: 'POST' });
    } catch {
      // ignore
    }
  },

  async logout(): Promise<void> {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearStoredAuth();
    }
  },

  async updateProfile(data: { username?: string; pin?: string; profile_photo?: string }): Promise<User> {
    const res = await fetchWithAuth<{ user: User }>('/api/auth/update_profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res.user;
  },

  async searchUsers(query: string): Promise<SearchUserResult[]> {
    const params = new URLSearchParams({ q: query });
    const res = await fetchWithAuth<{ users: SearchUserResult[] }>(`/api/users/search?${params.toString()}`);
    return res.users;
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const res = await fetchWithAuth<{ conversations: ConversationSummary[] }>('/api/conversations');
    return res.conversations;
  },

  async openConversation(targetUserId: string): Promise<ConversationSummary> {
    return await fetchWithAuth<ConversationSummary>('/api/conversations/open', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  },

  async togglePin(conversationId: string, pin: boolean): Promise<{ success: boolean; is_pinned: boolean }> {
    return await fetchWithAuth<{ success: boolean; is_pinned: boolean }>(`/api/conversations/${conversationId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    return await fetchWithAuth<{ success: boolean }>(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  },

  async clearMessages(conversationId: string): Promise<{ success: boolean }> {
    return await fetchWithAuth<{ success: boolean }>(`/api/conversations/${conversationId}/messages`, {
      method: 'DELETE',
    });
  },

  async toggleArchive(conversationId: string, archive: boolean): Promise<{ success: boolean; is_archived: boolean }> {
    return await fetchWithAuth<{ success: boolean; is_archived: boolean }>(`/api/conversations/${conversationId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archive }),
    });
  },

  async toggleMute(conversationId: string, mute: boolean): Promise<{ success: boolean; is_muted: boolean }> {
    return await fetchWithAuth<{ success: boolean; is_muted: boolean }>(`/api/conversations/${conversationId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ mute }),
    });
  },

  async toggleBlock(userId: string, block: boolean): Promise<{ success: boolean; is_blocked: boolean }> {
    return await fetchWithAuth<{ success: boolean; is_blocked: boolean }>(`/api/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ block }),
    });
  },

  async toggleRead(conversationId: string, read: boolean): Promise<{ success: boolean; unread_count: number }> {
    return await fetchWithAuth<{ success: boolean; unread_count: number }>(`/api/conversations/${conversationId}/read-status`, {
      method: 'POST',
      body: JSON.stringify({ read }),
    });
  },

  async getMessages(
    conversationId: string,
    options?: { since?: string; limit?: number },
  ): Promise<{ conversation_id: string; other_user: User; messages: Message[] }> {
    const params = new URLSearchParams();
    if (options?.since) params.set('since', options.since);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return await fetchWithAuth<{ conversation_id: string; other_user: User; messages: Message[] }>(
      `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`,
    );
  },

  async sendMessage(conversationId: string, message: string, receiverId?: string): Promise<{ message: Message }> {
    return await fetchWithAuth<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, receiver_id: receiverId }),
    });
  },

  async getVapidPublicKey(): Promise<string> {
    const res = await fetchWithAuth<{ publicKey: string }>('/api/push/vapid-public-key');
    return res.publicKey;
  },

  async savePushSubscription(subscription: any): Promise<void> {
    await fetchWithAuth('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    await fetchWithAuth('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  },

  async getPushStatus(): Promise<{ hasSubscription: boolean; count: number }> {
    return await fetchWithAuth<{ hasSubscription: boolean; count: number }>('/api/push/status');
  },

  async triggerServerTestPush(delayMs: number = 3000): Promise<{ success: boolean; message: string; sentCount?: number; errors?: number }> {
    return await fetchWithAuth<{ success: boolean; message: string; sentCount?: number; errors?: number }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({ delayMs }),
    });
  },

  async markDelivered(conversationId: string, messageId?: string): Promise<void> {
    try {
      await fetchWithAuth('/api/messages/delivered', {
        method: 'POST',
        body: JSON.stringify({ conversationId, messageId }),
      });
    } catch {
      // ignore
    }
  },

  async getSupabaseStatus(): Promise<{
    supabase_url: string;
    connected: boolean;
    tables_exist: boolean;
    error?: string;
    schema_sql: string;
  }> {
    const res = await fetch('/api/supabase/status');
    return await res.json();
  },
};

