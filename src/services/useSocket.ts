import { useEffect, useRef, useCallback } from 'react';
import { getStoredToken } from './api';
import { Message, User } from '../types';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://myoicywulrrzfohlsjfe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface UseSocketProps {
  currentUser: User | null;
  onNewMessage?: (msg: Message, conversationId: string, sender: User) => void;
  onMessageRead?: (conversationId: string, readerId: string) => void;
  onPresenceUpdate?: (userId: string, isOnline: boolean, lastSeen: string) => void;
}

export function useSocket({
  currentUser,
  onNewMessage,
  onMessageRead,
  onPresenceUpdate,
}: UseSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Keep callback refs fresh
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onMessageReadRef = useRef(onMessageRead);
  onMessageReadRef.current = onMessageRead;

  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;

  // Supabase Realtime Channel for Vercel / serverless deployments
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabaseClient
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const newRow = payload.new;
          if (newRow && (newRow.receiver_id === currentUser.id || newRow.sender_id === currentUser.id)) {
            const msg: Message = {
              id: newRow.id,
              conversation_id: newRow.conversation_id,
              sender_id: newRow.sender_id,
              receiver_id: newRow.receiver_id,
              message: newRow.message,
              created_at: newRow.created_at,
              read: newRow.read,
            };
            const senderUser: User = {
              id: newRow.sender_id,
              username: 'Usuário',
              profile_photo: '',
              created_at: '',
              updated_at: '',
              last_seen: '',
              is_online: true,
            };
            onNewMessageRef.current?.(msg, newRow.conversation_id, senderUser);
          }
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [currentUser]);

  const connect = useCallback(() => {
    if (!currentUser) return;
    const token = getStoredToken();
    if (!token) return;

    // Only attempt WebSocket if not on pure static hosting or fallback
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Authenticate socket
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message:new') {
            const { message, conversation_id, sender } = data.payload;
            onNewMessageRef.current?.(message, conversation_id, sender);
          } else if (data.type === 'message:read') {
            const { conversation_id, reader_id } = data.payload;
            onMessageReadRef.current?.(conversation_id, reader_id);
          } else if (data.type === 'user:presence') {
            const { user_id, is_online, last_seen } = data.payload;
            onPresenceUpdateRef.current?.(user_id, is_online, last_seen);
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (currentUser) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 4000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Ignored on serverless environments
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUser, connect]);

  const markConversationAsRead = useCallback((conversationId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'read_conversation',
          conversation_id: conversationId,
        }),
      );
    }
  }, []);

  return {
    markConversationAsRead,
  };
}
