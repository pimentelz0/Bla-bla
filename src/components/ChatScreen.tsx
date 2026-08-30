import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { Avatar } from './Avatar';
import { formatMessageTime, formatLastSeen } from '../utils/formatters';
import { parseMessageContent, compressImage } from '../utils/mediaHelper';
import { AudioPlayerMessage } from './AudioPlayerMessage';
import { AudioRecorderBar } from './AudioRecorderBar';
import { EmojiStickerPicker } from './EmojiStickerPicker';
import { ImageLightbox } from './ImageLightbox';
import { Sticker } from '../utils/stickers';
import {
  ArrowLeft,
  Send,
  Pin,
  Smile,
  Mic,
  Image as ImageIcon,
  Check,
  CheckCheck,
  ShieldBan,
  MoreVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatScreenProps {
  currentUser: User;
  otherUser: User;
  conversationId: string;
  messages: Message[];
  isLoadingMessages: boolean;
  isPinned: boolean;
  isBlocked?: boolean;
  onBack: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onTogglePin: () => void;
  onToggleBlock?: () => void;
  onOpenActions?: () => void;
  id?: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  otherUser,
  conversationId,
  messages,
  isLoadingMessages,
  isPinned,
  isBlocked = false,
  onBack,
  onSendMessage,
  onTogglePin,
  onToggleBlock,
  onOpenActions,
  id,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || isBlocked) return;

    setIsSending(true);
    setSendError(null);
    setShowPicker(false);

    try {
      setInputText('');
      await onSendMessage(trimmed);
      inputRef.current?.focus();
    } catch (err: any) {
      setSendError('Não foi possível enviar a mensagem. Tente novamente.');
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isBlocked) return;

    setIsSending(true);
    setSendError(null);

    try {
      const compressedDataUrl = await compressImage(file);
      const payload = JSON.stringify({
        type: 'image',
        url: compressedDataUrl,
        caption: inputText.trim() || undefined,
      });
      setInputText('');
      await onSendMessage(payload);
    } catch (err: any) {
      setSendError('Erro ao enviar foto. Tente novamente com outra imagem.');
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendAudio = async (audioDataUrl: string, duration: number) => {
    if (isBlocked) return;
    setIsRecordingAudio(false);
    setIsSending(true);
    setSendError(null);

    try {
      const payload = JSON.stringify({
        type: 'audio',
        url: audioDataUrl,
        duration,
      });
      await onSendMessage(payload);
    } catch (err) {
      setSendError('Erro ao enviar áudio. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSticker = async (sticker: Sticker) => {
    if (isBlocked) return;
    setShowPicker(false);
    setIsSending(true);
    setSendError(null);

    try {
      const payload = JSON.stringify({
        type: 'sticker',
        url: sticker.svgDataUri,
        id: sticker.id,
        name: sticker.name,
      });
      await onSendMessage(payload);
    } catch (err) {
      setSendError('Erro ao enviar figurinha.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div id={id} className="flex flex-col h-full bg-white relative">
      {/* Top Chat Header */}
      <header className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-3 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-[#17191C] hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar
            src={otherUser.profile_photo}
            name={otherUser.username}
            size="chat"
            isOnline={otherUser.is_online}
            showStatus
          />

          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[15px] text-[#17191C] truncate leading-tight">
              @{otherUser.username}
            </span>
            <span className="text-[12px] text-[#7A7F87] leading-tight flex items-center gap-1">
              {isBlocked ? (
                <span className="text-rose-500 font-medium">Bloqueado</span>
              ) : otherUser.is_online ? (
                <span className="text-emerald-600 font-medium">online</span>
              ) : (
                formatLastSeen(false, otherUser.last_seen)
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Desafixar conversa' : 'Fixar conversa'}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isPinned
                ? 'bg-[#EAF2FF] text-blue-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Pin className={`w-4 h-4 rotate-45 ${isPinned ? 'fill-blue-600' : ''}`} />
          </button>

          {onOpenActions && (
            <button
              onClick={onOpenActions}
              title="Mais opções"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Blocked Alert Banner */}
      {isBlocked && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Você bloqueou este usuário. Mensagens estão desativadas.</span>
          </div>
          {onToggleBlock && (
            <button
              onClick={onToggleBlock}
              className="font-semibold underline hover:text-rose-900 ml-2 shrink-0 cursor-pointer"
            >
              Desbloquear
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F6F7F9]/60">
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Carregando mensagens...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-2xl mb-3 shadow-xs">
              👋
            </div>
            <p className="font-semibold text-[#17191C] text-base">Comece a conversa 👋</p>
            <p className="text-xs text-[#7A7F87] mt-1 max-w-xs">
              Envie mensagens de texto, fotos, áudios, emojis e figurinhas para @{otherUser.username}.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUser.id;
              const prevMsg = messages[index - 1];
              const showDateHeader =
                !prevMsg ||
                new Date(prevMsg.created_at).toDateString() !==
                  new Date(msg.created_at).toDateString();

              const parsed = parseMessageContent(msg.message);

              return (
                <React.Fragment key={msg.id}>
                  {showDateHeader && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 bg-white/80 backdrop-blur-xs border border-gray-200/60 text-[#7A7F87] text-[11px] font-medium rounded-full shadow-2xs">
                        {new Date(msg.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                        })}
                      </span>
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* STICKER DISPLAY (WhatsApp Style: Transparent, large) */}
                    {parsed.type === 'sticker' ? (
                      <div className="flex flex-col items-center group">
                        <img
                          src={parsed.url}
                          alt={parsed.content || 'Figurinha'}
                          className="w-32 h-32 sm:w-36 sm:h-36 object-contain hover:scale-105 transition-transform drop-shadow-md cursor-pointer"
                        />
                        <div
                          className={`flex items-center gap-1 text-[10px] select-none mt-1 px-2 py-0.5 rounded-full bg-black/20 text-white backdrop-blur-xs`}
                        >
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isMe && (
                            <span>
                              {msg.read ? (
                                <CheckCheck className="w-3 h-3 text-cyan-300" title="Lida" />
                              ) : msg.delivered ? (
                                <CheckCheck className="w-3 h-3 text-white" title="Entregue" />
                              ) : (
                                <Check className="w-3 h-3 text-white/75" title="Enviada" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* STANDARD BUBBLE (Text, Image, Audio) */
                      <div
                        className={`relative max-w-[86%] sm:max-w-[72%] p-2.5 rounded-2xl break-words text-[14.5px] leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-blue-500 text-white rounded-tr-xs'
                            : 'bg-white text-[#17191C] border border-gray-100 rounded-tl-xs'
                        }`}
                      >
                        {/* PHOTO / IMAGE MESSAGE */}
                        {parsed.type === 'image' && (
                          <div className="space-y-1.5 mb-1">
                            <div
                              onClick={() =>
                                setLightboxImage({ url: parsed.url!, caption: parsed.content })
                              }
                              className="rounded-xl overflow-hidden cursor-pointer max-h-72 group relative bg-black/5"
                            >
                              <img
                                src={parsed.url}
                                alt="Foto enviada"
                                className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-200"
                                loading="lazy"
                              />
                            </div>
                            {parsed.content && (
                              <p className="whitespace-pre-wrap px-1 text-sm">{parsed.content}</p>
                            )}
                          </div>
                        )}

                        {/* VOICE NOTE / AUDIO MESSAGE */}
                        {parsed.type === 'audio' && (
                          <AudioPlayerMessage
                            audioUrl={parsed.url!}
                            duration={parsed.duration}
                            isMe={isMe}
                          />
                        )}

                        {/* TEXT MESSAGE */}
                        {parsed.type === 'text' && (
                          <p className="whitespace-pre-wrap">{parsed.content}</p>
                        )}

                        {/* Message Timestamp & Double Checkmarks */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10.5px] select-none ${
                            isMe ? 'text-blue-100' : 'text-[#7A7F87]'
                          }`}
                        >
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isMe && (
                            <span>
                              {msg.read ? (
                                <CheckCheck className="w-3.5 h-3.5 text-cyan-200" title="Lida" />
                              ) : msg.delivered ? (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-200/90" title="Entregue" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-blue-200/80" title="Enviada" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </React.Fragment>
              );
            })}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error alert if sending fails */}
      {sendError && (
        <div className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-medium flex items-center justify-between border-t border-rose-100">
          <span>{sendError}</span>
          <button
            onClick={() => handleSendText()}
            className="underline font-semibold hover:text-rose-700 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Fixed Bottom Input Bar & Tools */}
      <div className="shrink-0 bg-white border-t border-gray-100">
        {/* Hidden File Input for Photos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSendPhoto}
        />

        <div className="p-3 sm:p-4">
          {isRecordingAudio ? (
            /* Live Audio Recording Bar */
            <AudioRecorderBar
              onSendAudio={handleSendAudio}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            /* Standard Input Bar */
            <form onSubmit={handleSendText} className="flex items-center gap-1.5 sm:gap-2 max-w-4xl mx-auto">
              {/* Emoji & Sticker Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                disabled={isBlocked}
                className={`p-2.5 rounded-full transition-colors shrink-0 cursor-pointer ${
                  showPicker
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-[#7A7F87] hover:text-[#17191C] hover:bg-gray-100 active:bg-gray-200'
                }`}
                title="Emojis e Figurinhas"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Photo Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBlocked}
                className="p-2.5 text-[#7A7F87] hover:text-[#17191C] hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                title="Enviar Foto"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Text Input Field */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  disabled={isBlocked}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isBlocked ? 'Usuário bloqueado' : 'Mensagem...'}
                  className="w-full bg-[#F6F7F9] hover:bg-[#F0F2F5] focus:bg-white text-[#17191C] placeholder-[#7A7F87] text-sm px-4 py-2.5 rounded-2xl border border-transparent focus:border-blue-500 focus:outline-none transition-all disabled:opacity-60"
                />
              </div>

              {/* Dynamic Action: Send Button (if text entered) OR Audio Recorder Button (if empty) */}
              {inputText.trim() ? (
                <button
                  type="submit"
                  disabled={isSending || isBlocked}
                  className="p-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 text-white rounded-full transition-all shadow-xs shadow-blue-500/20 shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
                  title="Enviar mensagem"
                >
                  <Send className="w-4 h-4 translate-x-px" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRecordingAudio(true)}
                  disabled={isBlocked}
                  className="p-2.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-600 rounded-full transition-all shrink-0 flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Gravar áudio"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </form>
          )}
        </div>

        {/* Emoji & Sticker Drawer */}
        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <EmojiStickerPicker
                onSelectEmoji={handleSelectEmoji}
                onSelectSticker={handleSendSticker}
                onClose={() => setShowPicker(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full Photo Lightbox */}
      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        caption={lightboxImage?.caption}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
};
