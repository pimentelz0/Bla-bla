import React, { useRef } from 'react';
import { ConversationSummary } from '../types';
import { Avatar } from './Avatar';
import { formatChatListTime } from '../utils/formatters';
import { parseMessageContent } from '../utils/mediaHelper';
import { Pin, BellOff, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';

interface PinnedSectionProps {
  pinnedConversations: ConversationSummary[];
  onSelectConversation: (conv: ConversationSummary) => void;
  onOpenActions: (conv: ConversationSummary) => void;
}

export const PinnedSection: React.FC<PinnedSectionProps> = ({
  pinnedConversations,
  onSelectConversation,
  onOpenActions,
}) => {
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  if (pinnedConversations.length === 0) return null;

  const handleStart = (conv: ConversationSummary) => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (window.navigator?.vibrate) window.navigator.vibrate(40);
      onOpenActions(conv);
    }, 450);
  };

  const handleEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  return (
    <div className="px-4 py-2 border-b border-gray-100/60 bg-gray-50/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7A7F87]">
          <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 rotate-45" />
          <span>Fixados ({pinnedConversations.length}/3)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {pinnedConversations.map((conv) => {
          const hasUnread = conv.unread_count > 0;
          const parsed = parseMessageContent(conv.last_message || '');

          return (
            <motion.div
              key={conv.id}
              whileTap={{ scale: 0.98 }}
              onTouchStart={() => handleStart(conv)}
              onTouchEnd={handleEnd}
              onMouseDown={() => handleStart(conv)}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenActions(conv);
              }}
              onClick={() => {
                if (isLongPress.current) return;
                onSelectConversation(conv);
              }}
              className="group relative flex items-center gap-2.5 p-2.5 bg-white hover:bg-[#EAF2FF]/50 active:bg-[#EAF2FF] border border-gray-100 rounded-2xl cursor-pointer transition-all shadow-xs"
            >
              <Avatar
                src={conv.other_user.profile_photo}
                name={conv.other_user.username}
                size="sm"
                isOnline={conv.other_user.is_online}
                showStatus
              />

              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[13.5px] truncate ${hasUnread ? 'font-bold text-[#17191C]' : 'font-semibold text-[#17191C]'}`}>
                    @{conv.other_user.username}
                  </span>
                  <span className="text-[10.5px] text-[#7A7F87] shrink-0 font-normal">
                    {formatChatListTime(conv.last_message_at)}
                  </span>
                </div>

                <p className="text-[11.5px] text-[#7A7F87] truncate mt-0.5">
                  {parsed.type === 'image'
                    ? '📷 Foto'
                    : parsed.type === 'audio'
                    ? '🎤 Áudio'
                    : parsed.type === 'sticker'
                    ? '🎭 Figurinha'
                    : conv.last_message || 'Inicie uma conversa'}
                </p>
              </div>

              {conv.is_muted && (
                <BellOff className="w-3 h-3 text-gray-400 shrink-0" />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActions(conv);
                }}
                title="Opções"
                className="opacity-0 group-hover:opacity-100 p-1 text-[#7A7F87] hover:text-gray-900 rounded-lg transition-all shrink-0 cursor-pointer"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {hasUnread && (
                <div className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow-xs">
                  {conv.unread_count}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
