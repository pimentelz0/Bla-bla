import React, { useState, useRef } from 'react';
import { ConversationSummary } from '../types';
import { Avatar } from './Avatar';
import { formatChatListTime } from '../utils/formatters';
import { parseMessageContent } from '../utils/mediaHelper';
import { Pin, BellOff, Archive, ShieldBan, MoreVertical, CheckCheck, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface ChatItemProps {
  conversation: ConversationSummary;
  isSelected?: boolean;
  currentUserId?: string;
  onSelect: () => void;
  onOpenActions: (conv: ConversationSummary) => void;
  id?: string;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  conversation,
  isSelected = false,
  currentUserId,
  onSelect,
  onOpenActions,
  id,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const touchStartX = useRef(0);

  const hasUnread = conversation.unread_count > 0;
  const parsed = parseMessageContent(conversation.last_message || '');

  // Helper to format last message summary text
  const renderMessagePreview = () => {
    if (!conversation.last_message) {
      return <span className="italic text-gray-400">Nenhuma mensagem ainda</span>;
    }
    if (parsed.type === 'image') {
      return (
        <span className="flex items-center gap-1 text-blue-600 font-medium">
          <span>📷</span> Foto {parsed.content ? `• ${parsed.content}` : ''}
        </span>
      );
    }
    if (parsed.type === 'audio') {
      const durationSec = parsed.duration || 0;
      const min = Math.floor(durationSec / 60);
      const sec = Math.floor(durationSec % 60);
      const formatted = `${min}:${sec.toString().padStart(2, '0')}`;
      return (
        <span className="flex items-center gap-1 text-blue-600 font-medium">
          <span>🎤</span> Áudio ({formatted})
        </span>
      );
    }
    if (parsed.type === 'sticker') {
      return (
        <span className="flex items-center gap-1 text-purple-600 font-medium">
          <span>🎭</span> Figurinha
        </span>
      );
    }
    return parsed.content;
  };

  // Long press handling for Touch and Mouse
  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPress.current = false;
    touchStartX.current = e.touches[0].clientX;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      onOpenActions(conversation);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (Math.abs(diff) > 10 && pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    // Allow slight left swipe to trigger menu
    if (diff < 0 && diff > -100) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    if (swipeOffset < -60) {
      onOpenActions(conversation);
    }
    setSwipeOffset(0);
  };

  const handleMouseDown = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onOpenActions(conversation);
    }, 500);
  };

  const handleMouseUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelect();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenActions(conversation);
  };

  return (
    <div
      id={id}
      className="relative group border-b border-gray-100/80 last:border-none overflow-hidden select-none"
    >
      <motion.div
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#EAF2FF]'
            : 'bg-white hover:bg-[#F6F7F9] active:bg-[#EAF2FF]/60'
        }`}
      >
        {/* User Profile Avatar */}
        <Avatar
          src={conversation.other_user.profile_photo}
          name={conversation.other_user.username}
          size="md"
          isOnline={conversation.other_user.is_online}
          showStatus
        />

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Username + Status Badges + Timestamp */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`truncate text-[15px] ${
                  hasUnread ? 'font-bold text-[#17191C]' : 'font-medium text-[#17191C]'
                }`}
              >
                @{conversation.other_user.username}
              </span>

              {/* Badges */}
              {conversation.is_pinned && (
                <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0 rotate-45" title="Fixada" />
              )}
              {conversation.is_muted && (
                <BellOff className="w-3.5 h-3.5 text-gray-400 shrink-0" title="Silenciada" />
              )}
              {conversation.is_archived && (
                <Archive className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Arquivada" />
              )}
              {conversation.is_blocked && (
                <ShieldBan className="w-3.5 h-3.5 text-rose-500 shrink-0" title="Bloqueado" />
              )}
            </div>

            <span
              className={`text-[11.5px] shrink-0 ${
                hasUnread ? 'font-semibold text-blue-600' : 'text-[#7A7F87]'
              }`}
            >
              {formatChatListTime(conversation.last_message_at)}
            </span>
          </div>

          {/* Sub Row: Message preview + Unread Badge + Action Trigger */}
          <div className="flex items-center justify-between gap-2">
            <div
              className={`text-[13px] truncate flex items-center gap-1 min-w-0 ${
                hasUnread ? 'font-medium text-[#17191C]' : 'text-[#7A7F87]'
              }`}
            >
              {conversation.last_sender_id && currentUserId && conversation.last_sender_id === currentUserId && (
                <span className="shrink-0">
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                </span>
              )}
              <span className="truncate">{renderMessagePreview()}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasUnread && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold shadow-xs">
                  {conversation.unread_count}
                </span>
              )}

              {/* Action Menu button on hover or tap */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActions(conversation);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                title="Ações da conversa (Segure ou clique aqui)"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
