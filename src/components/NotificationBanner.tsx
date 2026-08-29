import React, { useEffect } from 'react';
import { Avatar } from './Avatar';
import { Message, User } from '../types';
import { parseMessageContent } from '../utils/mediaHelper';
import { X, MessageSquare } from 'lucide-react';
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
  onOpen: (conversationId: string) => void;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onOpen,
  onDismiss,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const parsed = parseMessageContent(notification.message.message);

  const getPreviewText = () => {
    if (parsed.type === 'image') return '📷 Foto' + (parsed.content ? ` • ${parsed.content}` : '');
    if (parsed.type === 'audio') return '🎤 Mensagem de voz';
    if (parsed.type === 'sticker') return '🎭 Figurinha';
    return parsed.content || 'Nova mensagem';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        className="fixed top-3 left-0 right-0 z-50 flex justify-center px-3 pointer-events-none"
      >
        <div
          onClick={() => onOpen(notification.conversationId)}
          className="pointer-events-auto w-full max-w-md bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-xl shadow-black/10 rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white active:scale-[0.99] transition-all"
        >
          {/* Sender Avatar */}
          <Avatar
            src={notification.sender.profile_photo}
            name={notification.sender.username}
            size="sm"
            showStatus={false}
          />

          {/* Text Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] font-bold text-[#17191C] truncate">
                  @{notification.sender.username}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold uppercase tracking-wider">
                  Blá Blá
                </span>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0">agora</span>
            </div>
            <p className="text-[12.5px] text-[#4F555E] truncate leading-tight font-normal">
              {getPreviewText()}
            </p>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
