import { useEffect, useRef, useCallback } from 'react';
import { getStoredToken, api } from './api';
import { Message, User } from '../types';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://myoicywulrrzfohlsjfe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface UseSocketProps {
  currentUser: User | null;
  onNewMessage?: (msg: Message, conversationId: string, sender?: User) => void;
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
  const heartbeatIntervalRef = useRef<number | null>(null);

  // Keep callback refs fresh
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onMessageReadRef = useRef(onMessageRead);
  onMessageReadRef.current = onMessageRead;

  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;

  // 1. Supabase Realtime Message Sync
  useEffect(() => {
    if (!currentUser) return;

    const messageChannel = supabaseClient
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
            onNewMessageRef.current?.(msg, newRow.conversation_id);
          }
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(messageChannel);
    };
  }, [currentUser]);

  // 2. Supabase Realtime Presence Sync (Accurate Online / Offline detection across all devices)
  useEffect(() => {
    if (!currentUser) return;

    const presenceChannel = supabaseClient.channel('presence:online_users', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineUserIds = new Set(Object.keys(state));
        const now = new Date().toISOString();
        
        onlineUserIds.forEach((uid) => {
          if (uid !== currentUser.id) {
            onPresenceUpdateRef.current?.(uid, true, now);
          }
        });
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key && key !== currentUser.id) {
          onPresenceUpdateRef.current?.(key, true, new Date().toISOString());
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key && key !== currentUser.id) {
          onPresenceUpdateRef.current?.(key, false, new Date().toISOString());
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUser.id,
            username: currentUser.username,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.untrack();
      supabaseClient.removeChannel(presenceChannel);
    };
  }, [currentUser]);

  // 3. Heartbeat & Page Lifecycle (Only online when actively in the app)
  useEffect(() => {
    if (!currentUser) return;

    const sendPulse = async () => {
      if (document.visibilityState === 'visible') {
        await api.heartbeat();
      }
    };

    // Initial pulse
    sendPulse();

    // Heartbeat every 20 seconds
    heartbeatIntervalRef.current = window.setInterval(sendPulse, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendPulse();
      } else {
        // When tab is hidden/minimized, update last_seen
        api.heartbeat();
      }
    };

    const handleBeforeUnload = () => {
      if (currentUser) {
        // Best effort to set offline immediately when tab closes
        navigator.sendBeacon?.('/api/auth/offline');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentUser]);

  // 4. WebSocket fallback for full-stack Node.js server
  const connect = useCallback(() => {
    if (!currentUser) return;
    const token = getStoredToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
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
