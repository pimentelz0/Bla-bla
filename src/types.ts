export interface User {
  id: string;
  username: string;
  profile_photo: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
  is_online?: boolean;
  is_blocked?: boolean;
  has_push_enabled?: boolean;
}

export type MessageType = 'text' | 'image' | 'audio' | 'sticker';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  delivered?: boolean;
  read: boolean;
  media_type?: MessageType;
  media_url?: string;
  audio_duration?: number;
}

export interface ConversationSummary {
  id: string;
  other_user: User;
  last_message: string;
  last_message_at: string;
  last_sender_id?: string;
  unread_count: number;
  is_pinned: boolean;
  pin_position?: number;
  is_muted?: boolean;
  is_archived?: boolean;
  is_blocked?: boolean;
}

export interface SearchUserResult extends User {
  conversation_id?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}
