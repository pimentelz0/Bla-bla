import React, { useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import { Message, User } from '../types';
import { parseMessageContent } from '../utils/mediaHelper';
import { X, MessageCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface IncomingNotification {
  id: string;
  conversationId: string;
  sender: User;
  message: Message;
  receivedAt: Date;
}

interface NotificationBannerProps {
  notification: IncomingNotification | null;
  onOpenConversation: (conversationId: string) => void;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onOpenConversation,
  onDismiss,
}) => {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!notification) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      onDismiss();
    }, 6000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [notification, onDismiss]);

  if (!notification) return null;

  const parsed = parseMessageContent(notification.message.message);

  const getPreviewContent = () => {
    if (parsed.type === 'image') {
      return (
        <span className="flex items-center gap-1.5 text-[#17191C]">
          <span>📷</span>
          <span className="font-medium text-gray-700">Foto</span>
          {parsed.content && <span className="text-gray-500 truncate">• {parsed.content}</span>}
        </span>
      );
    }
    if (parsed.type === 'audio') {
      return (
        <span className="flex items-center gap-1.5 text-[#17191C]">
          <span>🎤</span>
          <span className="font-medium text-gray-700">Mensagem de voz</span>
        </span>
      );
    }
    if (parsed.type === 'sticker') {
      return (
        <span className="flex items-center gap-1.5 text-[#17191C]">
          <span>🎭</span>
          <span className="font-medium text-gray-700">Figurinha</span>
        </span>
      );
    }
    return <span className="text-gray-700 truncate">{notification.message.message}</span>;
  };

  return (
    <AnimatePresence>
      <div className="fixed top-3 inset-x-0 z-50 flex justify-center px-3.5 pointer-events-none">
        <motion.div
          initial={{ y: -70, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -70, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 380 }}
          drag="y"
          dragConstraints={{ top: -50, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -20 || info.velocity.y < -300) {
              onDismiss();
            }
          }}
          onClick={() => onOpenConversation(notification.conversationId)}
          className="pointer-events-auto w-full max-w-md bg-white/98 backdrop-blur-xl border border-gray-200/80 shadow-[0_12px_36px_rgba(0,0,0,0.14)] rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white active:scale-[0.99] transition-all select-none group"
        >
          {/* Avatar with Status indicator */}
          <div className="relative shrink-0">
            <Avatar
              src={notification.sender.profile_photo}
              name={notification.sender.username}
              size="md"
              showStatus={false}
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75" />
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13.5px] font-bold text-[#17191C] truncate">
                  @{notification.sender.username}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full uppercase tracking-wider">
                  Blá Blá
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium shrink-0">agora</span>
            </div>

            <div className="text-[13px] leading-tight flex items-center">{getPreviewContent()}</div>
          </div>

          {/* Action pill / Reply */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConversation(notification.conversationId);
              }}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            >
              <span>Abrir</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
