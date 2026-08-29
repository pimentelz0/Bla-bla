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
  } catch (err: any) {
    throw new Error('Falha na conexão com o servidor. Verifique sua internet.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`Erro do servidor (${response.status}). Tente novamente.`);
    }
    throw new Error('Resposta inesperada do servidor.');
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Erro ao processar resposta do servidor.');
  }

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `Erro na requisição (${response.status}).`);
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
      throw new Error('Falha ao registrar usuário: resposta inválida do servidor.');
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
      throw new Error('Falha ao autenticar usuário: resposta inválida do servidor.');
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

  async getMessages(conversationId: string): Promise<{ conversation_id: string; other_user: User; messages: Message[] }> {
    return await fetchWithAuth<{ conversation_id: string; other_user: User; messages: Message[] }>(
      `/api/conversations/${conversationId}/messages`,
    );
  },

  async sendMessage(conversationId: string, message: string): Promise<{ message: Message }> {
    return await fetchWithAuth<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
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

