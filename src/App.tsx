import React, { useState, useEffect, useCallback } from 'react';
import { User, ConversationSummary, Message, SearchUserResult } from './types';
import { api, getStoredUser, clearStoredAuth } from './services/api';
import { useSocket } from './services/useSocket';
import { Avatar } from './components/Avatar';
import { PinnedSection } from './components/PinnedSection';
import { ChatItem } from './components/ChatItem';
import { ChatScreen } from './components/ChatScreen';
import { SearchModal } from './components/SearchModal';
import { ProfileModal } from './components/ProfileModal';
import { AuthScreen } from './components/AuthScreen';
import { ConversationActionMenu } from './components/ConversationActionMenu';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Search, Plus, MessageSquare, Users, Archive, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser());

  // Modals & Sheets
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [actionMenuConversation, setActionMenuConversation] = useState<ConversationSummary | null>(null);
  const [showArchivedView, setShowArchivedView] = useState(false);

  // Conversations & Active Chat
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `t_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check auth session silently in background on load
  useEffect(() => {
    async function verifyAuth() {
      if (!currentUser) return;
      try {
        const fresh = await api.getMe();
        setCurrentUser(fresh);
      } catch (err: any) {
        if (err?.message?.includes('401') || err?.message?.includes('expirada') || err?.message?.includes('autorizado')) {
          console.warn('Session expired or invalid:', err);
          clearStoredAuth();
          setCurrentUser(null);
        }
      }
    }
    verifyAuth();
  }, []);

  // Fetch conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingConversations(true);
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser, loadConversations]);

  // Load messages when active conversation changes
  const loadMessages = useCallback(
    async (convId: string) => {
      setIsLoadingMessages(true);
      try {
        const res = await api.getMessages(convId);
        setActiveMessages(res.messages);

        // Clear unread count for this conversation in list
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)),
        );
      } catch (err: any) {
        showToast(err.message || 'Erro ao carregar mensagens', 'error');
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setActiveMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // Real-time WebSocket Handlers
  const handleNewMessage = useCallback(
    (msg: Message, conversationId: string) => {
      // If currently inside the active chat
      if (activeConversationId === conversationId) {
        setActiveMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.receiver_id === currentUser?.id) {
          api.getMessages(conversationId).catch(() => {});
        }
      }

      // Update conversations list
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === conversationId);
        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          const isCurrentlyActive = activeConversationId === conversationId;
          const updatedConv: ConversationSummary = {
            ...existing,
            last_message: msg.message,
            last_message_at: msg.created_at,
            last_sender_id: msg.sender_id,
            unread_count:
              isCurrentlyActive || msg.sender_id === currentUser?.id
                ? 0
                : existing.unread_count + 1,
          };

          const rest = prev.filter((c) => c.id !== conversationId);
          return [updatedConv, ...rest].sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            if (a.is_pinned && b.is_pinned) {
              return (a.pin_position ?? 0) - (b.pin_position ?? 0);
            }
            return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
          });
        } else {
          loadConversations();
          return prev;
        }
      });
    },
    [activeConversationId, currentUser, loadConversations],
  );

  const handleMessageRead = useCallback((conversationId: string) => {
    setActiveMessages((prev) =>
      prev.map((m) => (m.conversation_id === conversationId ? { ...m, read: true } : m)),
    );
  }, []);

  const handlePresenceUpdate = useCallback(
    (userId: string, isOnline: boolean, lastSeen: string) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.other_user.id === userId) {
            return {
              ...c,
              other_user: {
                ...c.other_user,
                is_online: isOnline,
                last_seen: lastSeen,
              },
            };
          }
          return c;
        }),
      );
    },
    [],
  );

  useSocket({
    currentUser,
    onNewMessage: handleNewMessage,
    onMessageRead: handleMessageRead,
    onPresenceUpdate: handlePresenceUpdate,
  });

  // Action Menu Handlers
  const handleTogglePin = async (conv: ConversationSummary) => {
    const newPinState = !conv.is_pinned;
    const currentlyPinned = conversations.filter((c) => c.is_pinned);
    if (newPinState && currentlyPinned.length >= 3) {
      showToast('Você pode fixar até 3 conversas.', 'info');
      return;
    }

    try {
      const res = await api.togglePin(conv.id, newPinState);
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conv.id ? { ...c, is_pinned: res.is_pinned } : c,
        );
        return updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (a.is_pinned && b.is_pinned) {
            return (a.pin_position ?? 0) - (b.pin_position ?? 0);
          }
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        });
      });
      showToast(
        res.is_pinned
          ? `Conversa com @${conv.other_user.username} fixada.`
          : `Conversa desafixada.`,
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar fixação.', 'error');
    }
  };

  const handleToggleArchive = async (conv: ConversationSummary) => {
    const newArchiveState = !conv.is_archived;
    try {
      const res = await api.toggleArchive(conv.id, newArchiveState);
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, is_archived: res.is_archived } : c)),
      );
      showToast(
        res.is_archived
          ? `Conversa com @${conv.other_user.username} arquivada.`
          : `Conversa desarquivada.`,
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao arquivar conversa.', 'error');
    }
  };

  const handleToggleMute = async (conv: ConversationSummary) => {
    const newMuteState = !conv.is_muted;
    try {
      const res = await api.toggleMute(conv.id, newMuteState);
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, is_muted: res.is_muted } : c)),
      );
      showToast(
        res.is_muted
          ? `Notificações de @${conv.other_user.username} silenciadas.`
          : `Notificações ativadas.`,
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao silenciar conversa.', 'error');
    }
  };

  const handleToggleBlock = async (conv: ConversationSummary) => {
    const newBlockState = !conv.is_blocked;
    try {
      const res = await api.toggleBlock(conv.other_user.id, newBlockState);
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, is_blocked: res.is_blocked } : c)),
      );
      showToast(
        res.is_blocked
          ? `@${conv.other_user.username} foi bloqueado.`
          : `@${conv.other_user.username} foi desbloqueado.`,
        'info',
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao bloquear usuário.', 'error');
    }
  };

  const handleToggleRead = async (conv: ConversationSummary) => {
    const markAsRead = conv.unread_count > 0;
    try {
      const res = await api.toggleRead(conv.id, !markAsRead);
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: res.unread_count } : c)),
      );
      showToast(
        markAsRead ? 'Marcada como lida.' : 'Marcada como não lida.',
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status.', 'error');
    }
  };

  const handleClearMessages = async (conv: ConversationSummary) => {
    try {
      await api.clearMessages(conv.id);
      if (activeConversationId === conv.id) {
        setActiveMessages([]);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? { ...c, last_message: '', last_message_at: new Date().toISOString(), unread_count: 0 }
            : c,
        ),
      );
      showToast('Mensagens limpas com sucesso.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao limpar mensagens.', 'error');
    }
  };

  const handleDeleteConversation = async (conv: ConversationSummary) => {
    try {
      await api.deleteConversation(conv.id);
      if (activeConversationId === conv.id) {
        setActiveConversationId(null);
        setActiveMessages([]);
      }
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      showToast('Conversa excluída.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir conversa.', 'error');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    const res = await api.sendMessage(activeConversationId, text);
    setActiveMessages((prev) => [...prev, res.message]);

    // Update conversation in list
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            last_message: text,
            last_message_at: res.message.created_at,
            last_sender_id: currentUser?.id,
          };
        }
        return c;
      });
      return updated.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        if (a.is_pinned && b.is_pinned) {
          return (a.pin_position ?? 0) - (b.pin_position ?? 0);
        }
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    });
  };

  const handleSelectUserToChat = async (targetUser: SearchUserResult) => {
    setIsSearchOpen(false);
    try {
      const conv = await api.openConversation(targetUser.id);
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id);
        if (!exists) {
          return [conv, ...prev];
        }
        return prev;
      });
      setActiveConversationId(conv.id);
    } catch (err: any) {
      showToast(err.message || 'Erro ao abrir conversa.', 'error');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setActiveConversationId(null);
    setConversations([]);
    setIsProfileOpen(false);
    showToast('Você saiu da sua conta.', 'info');
  };

  if (!currentUser) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AuthScreen
          onAuthSuccess={(user) => {
            setCurrentUser(user);
          }}
          onShowToast={showToast}
        />
      </>
    );
  }

  // Filter archived vs active
  const activeChatList = conversations.filter((c) => (showArchivedView ? c.is_archived : !c.is_archived));
  const archivedCount = conversations.filter((c) => c.is_archived).length;
  const pinnedConversations = activeChatList.filter((c) => c.is_pinned);
  const unpinnedConversations = activeChatList.filter((c) => !c.is_pinned);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="h-screen w-full bg-[#F6F7F9] flex items-center justify-center sm:p-4 overflow-hidden select-none">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Main App Container */}
      <div className="w-full max-w-5xl h-full sm:h-[94vh] bg-white sm:rounded-3xl shadow-xl sm:border border-gray-100 flex overflow-hidden relative">
        {/* Left / Main Chats Column */}
        <div
          className={`flex flex-col h-full w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-gray-100 bg-white z-0 transition-all ${
            activeConversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <header className="shrink-0 px-4 py-3.5 flex items-center justify-between border-b border-gray-100 bg-white">
            {showArchivedView ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowArchivedView(false)}
                  className="p-1.5 -ml-1 text-[#17191C] hover:bg-gray-100 rounded-full cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold text-[#17191C] tracking-tight">Arquivadas</h1>
              </div>
            ) : (
              <h1 className="text-xl font-bold text-[#17191C] tracking-tight">Conversas</h1>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-[#7A7F87] hover:text-[#17191C] hover:bg-[#F6F7F9] active:bg-gray-200 rounded-full transition-colors cursor-pointer"
                title="Pesquisar usuários"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsProfileOpen(true)}
                className="p-1 rounded-full hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer"
                title={`Perfil de @${currentUser.username}`}
              >
                <Avatar
                  src={currentUser.profile_photo}
                  name={currentUser.username}
                  size="sm"
                  isOnline
                  showStatus
                />
              </button>
            </div>
          </header>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Archived Chats Access Bar (if not currently in archived view) */}
            {!showArchivedView && archivedCount > 0 && (
              <button
                onClick={() => setShowArchivedView(true)}
                className="w-full px-4 py-3 bg-gray-50/70 hover:bg-gray-100/80 active:bg-gray-200/60 border-b border-gray-100 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#17191C] block">Conversas Arquivadas</span>
                    <span className="text-[11px] text-[#7A7F87]">
                      {archivedCount} {archivedCount === 1 ? 'conversa' : 'conversas'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-600">Ver</span>
              </button>
            )}

            {/* Pinned Section */}
            {!showArchivedView && (
              <PinnedSection
                pinnedConversations={pinnedConversations}
                onSelectConversation={(conv) => setActiveConversationId(conv.id)}
                onOpenActions={(conv) => setActionMenuConversation(conv)}
              />
            )}

            {/* All Conversations List */}
            <div className="py-2">
              <div className="px-4 py-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7F87]">
                  {showArchivedView ? 'Conversas Arquivadas' : 'Todas as conversas'}
                </span>
                <span className="text-[11px] text-[#7A7F87] font-medium">
                  {activeChatList.length} {activeChatList.length === 1 ? 'conversa' : 'conversas'}
                </span>
              </div>

              {isLoadingConversations && conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs">Carregando conversas...</span>
                </div>
              ) : activeChatList.length === 0 ? (
                <div className="py-12 px-6 text-center flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3 shadow-2xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-[#17191C] text-base">
                    {showArchivedView ? 'Nenhuma conversa arquivada' : 'Ainda não há conversas.'}
                  </h3>
                  <p className="text-xs text-[#7A7F87] mt-1 max-w-xs mb-4">
                    {showArchivedView
                      ? 'Você pode arquivar conversas segurando o dedo sobre elas.'
                      : 'Pesquise alguém para começar a conversar no Blá Blá.'}
                  </p>
                  {!showArchivedView && (
                    <button
                      onClick={() => setIsSearchOpen(true)}
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-2xl text-xs font-semibold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      Encontrar pessoas
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unpinnedConversations.map((conv) => (
                    <ChatItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={activeConversationId === conv.id}
                      onSelect={() => setActiveConversationId(conv.id)}
                      onOpenActions={(targetConv) => setActionMenuConversation(targetConv)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Button to Start Chat */}
          {!showArchivedView && (
            <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-2xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer w-full justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>Nova conversa</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Active Chat View */}
        <div
          className={`flex-1 h-full bg-white transition-all ${
            activeConversationId ? 'flex flex-col' : 'hidden md:flex flex-col'
          }`}
        >
          {activeConversation ? (
            <ChatScreen
              currentUser={currentUser}
              otherUser={activeConversation.other_user}
              conversationId={activeConversation.id}
              messages={activeMessages}
              isLoadingMessages={isLoadingMessages}
              isPinned={activeConversation.is_pinned}
              isBlocked={activeConversation.is_blocked}
              onBack={() => setActiveConversationId(null)}
              onSendMessage={handleSendMessage}
              onTogglePin={() => handleTogglePin(activeConversation)}
              onToggleBlock={() => handleToggleBlock(activeConversation)}
              onOpenActions={() => setActionMenuConversation(activeConversation)}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#F6F7F9]/40 text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-xs border border-gray-100 flex items-center justify-center mb-4 text-3xl text-blue-500">
                💬
              </div>
              <h2 className="font-bold text-[#17191C] text-lg">Blá Blá Mensagens</h2>
              <p className="text-xs text-[#7A7F87] mt-1 max-w-xs">
                Selecione uma conversa ao lado ou busque um usuário para começar a papear.
              </p>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="mt-4 px-4 py-2 bg-[#EAF2FF] hover:bg-blue-100 text-blue-600 rounded-2xl text-xs font-semibold transition-all cursor-pointer"
              >
                Buscar amigos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Menu (Swipe / Long Press / Context Menu) */}
      <ConversationActionMenu
        isOpen={Boolean(actionMenuConversation)}
        conversation={actionMenuConversation}
        onClose={() => setActionMenuConversation(null)}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onToggleMute={handleToggleMute}
        onToggleBlock={handleToggleBlock}
        onToggleRead={handleToggleRead}
        onClearMessages={handleClearMessages}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectUser={handleSelectUserToChat}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        currentUser={currentUser}
        user={currentUser}
        onClose={() => setIsProfileOpen(false)}
        onProfileUpdated={(updated) => {
          setCurrentUser(updated);
          showToast('Perfil atualizado com sucesso!', 'success');
        }}
        onUpdateUser={(updated) => {
          setCurrentUser(updated);
          showToast('Perfil atualizado com sucesso!', 'success');
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}
