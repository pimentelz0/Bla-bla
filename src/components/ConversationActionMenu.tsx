import React from 'react';
import { ConversationSummary } from '../types';
import { Avatar } from './Avatar';
import {
  Pin,
  BellOff,
  Bell,
  Archive,
  ArchiveRestore,
  Trash2,
  Eraser,
  Mail,
  MailOpen,
  ShieldBan,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConversationActionMenuProps {
  conversation: ConversationSummary | null;
  isOpen?: boolean;
  onClose: () => void;
  onTogglePin: (conv: ConversationSummary) => void;
  onToggleMute: (conv: ConversationSummary) => void;
  onToggleArchive: (conv: ConversationSummary) => void;
  onToggleRead: (conv: ConversationSummary) => void;
  onClearMessages: (conv: ConversationSummary) => void;
  onToggleBlock: (conv: ConversationSummary) => void;
  onDeleteConversation: (conv: ConversationSummary) => void;
}

export const ConversationActionMenu: React.FC<ConversationActionMenuProps> = ({
  conversation,
  isOpen,
  onClose,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  onToggleRead,
  onClearMessages,
  onToggleBlock,
  onDeleteConversation,
}) => {
  const visible = isOpen !== undefined ? isOpen : Boolean(conversation);
  if (!visible || !conversation) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        {/* Modal / Action Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Header with User Info */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                src={conversation.other_user.profile_photo}
                name={conversation.other_user.username}
                size="md"
                isOnline={conversation.other_user.is_online}
                showStatus
              />
              <div className="min-w-0">
                <div className="font-bold text-[15px] text-[#17191C] truncate">
                  @{conversation.other_user.username}
                </div>
                <div className="text-xs text-[#7A7F87] truncate">
                  Opções de conversa
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action List */}
          <div className="space-y-1">
            {/* Pin / Unpin */}
            <button
              onClick={() => {
                onTogglePin(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-[#F6F7F9] text-left transition-colors text-sm font-medium text-[#17191C] cursor-pointer"
            >
              <Pin
                className={`w-4 h-4 ${
                  conversation.is_pinned
                    ? 'fill-blue-500 text-blue-500 rotate-45'
                    : 'text-gray-500 rotate-45'
                }`}
              />
              <span>{conversation.is_pinned ? 'Desafixar do topo' : 'Fixar conversa no topo'}</span>
            </button>

            {/* Mute / Unmute */}
            <button
              onClick={() => {
                onToggleMute(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-[#F6F7F9] text-left transition-colors text-sm font-medium text-[#17191C] cursor-pointer"
            >
              {conversation.is_muted ? (
                <>
                  <Bell className="w-4 h-4 text-emerald-600" />
                  <span>Ativar notificações de som</span>
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4 text-gray-500" />
                  <span>Silenciar notificações</span>
                </>
              )}
            </button>

            {/* Archive / Unarchive */}
            <button
              onClick={() => {
                onToggleArchive(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-[#F6F7F9] text-left transition-colors text-sm font-medium text-[#17191C] cursor-pointer"
            >
              {conversation.is_archived ? (
                <>
                  <ArchiveRestore className="w-4 h-4 text-blue-600" />
                  <span>Desarquivar conversa</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 text-gray-500" />
                  <span>Arquivar conversa</span>
                </>
              )}
            </button>

            {/* Mark as Unread / Read */}
            <button
              onClick={() => {
                onToggleRead(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-[#F6F7F9] text-left transition-colors text-sm font-medium text-[#17191C] cursor-pointer"
            >
              {conversation.unread_count > 0 ? (
                <>
                  <MailOpen className="w-4 h-4 text-blue-600" />
                  <span>Marcar como lida</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>Marcar como não lida</span>
                </>
              )}
            </button>

            {/* Clear Messages */}
            <button
              onClick={() => {
                onClearMessages(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-amber-50 text-left transition-colors text-sm font-medium text-amber-700 cursor-pointer"
            >
              <Eraser className="w-4 h-4 text-amber-600" />
              <span>Limpar histórico de mensagens</span>
            </button>

            {/* Block / Unblock User */}
            <button
              onClick={() => {
                onToggleBlock(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-rose-50 text-left transition-colors text-sm font-medium text-rose-700 cursor-pointer"
            >
              {conversation.is_blocked ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Desbloquear usuário</span>
                </>
              ) : (
                <>
                  <ShieldBan className="w-4 h-4 text-rose-600" />
                  <span>Bloquear @{conversation.other_user.username}</span>
                </>
              )}
            </button>

            {/* Delete Chat */}
            <button
              onClick={() => {
                onDeleteConversation(conversation);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-rose-50 text-left transition-colors text-sm font-semibold text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Excluir conversa</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
