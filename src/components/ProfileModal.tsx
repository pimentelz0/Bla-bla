import React, { useState, useRef } from 'react';
import { User } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';
import { X, Camera, LogOut, Key, Check, Bell, ExternalLink, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { INVENTED_EMOJIS } from '../utils/customAvatars';
import {
  playNotificationSound,
  sendBrowserNotification,
  scheduleBackgroundNotification,
  requestNotificationPermission,
  getNotificationPermission,
  isInIframe,
  isIOS,
  isStandalone,
} from '../utils/notifications';

interface ProfileModalProps {
  isOpen: boolean;
  currentUser?: User | null;
  user?: User | null;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  currentUser: propCurrentUser,
  user: propUser,
  onClose,
  onProfileUpdated,
  onUpdateUser,
  onLogout,
}) => {
  const activeUser = propCurrentUser || propUser;
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(activeUser?.username || '');
  const [newPin, setNewPin] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(activeUser?.profile_photo || '');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scheduledCountdown, setScheduledCountdown] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever activeUser or isOpen changes
  React.useEffect(() => {
    if (activeUser) {
      setNewUsername(activeUser.username || '');
      setSelectedPhoto(activeUser.profile_photo || '');
      setCustomPhotoUrl('');
      setNewPin('');
    }
  }, [activeUser, isOpen]);

  if (!isOpen || !activeUser) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const updatePayload: { username?: string; pin?: string; profile_photo?: string } = {};

    const cleanUsername = newUsername.trim().toLowerCase().replace(/^@/, '');
    if (cleanUsername !== activeUser.username) {
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        setErrorMsg('O nome de usuário deve ter entre 3 e 20 caracteres (apenas letras, números e _).');
        return;
      }
      updatePayload.username = cleanUsername;
    }

    if (newPin.trim()) {
      if (!/^\d{4}$/.test(newPin.trim())) {
        setErrorMsg('A nova senha deve ter exatamente 4 números.');
        return;
      }
      updatePayload.pin = newPin.trim();
    }

    const photoToSave = customPhotoUrl.trim() || selectedPhoto;
    if (photoToSave && photoToSave !== activeUser.profile_photo) {
      updatePayload.profile_photo = photoToSave;
    }

    if (Object.keys(updatePayload).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const updated = await api.updateProfile(updatePayload);
      if (onProfileUpdated) onProfileUpdated(updated);
      if (onUpdateUser) onUpdateUser(updated);
      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setSelectedPhoto(reader.result as string);
          setCustomPhotoUrl('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-[#17191C] text-lg">Meu Perfil</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group">
              <Avatar
                src={isEditing ? (customPhotoUrl.trim() || selectedPhoto) : activeUser.profile_photo}
                name={activeUser.username}
                size="xl"
                className="ring-4 ring-blue-50 shadow-md"
              />
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-transform hover:scale-105"
                  title="Carregar foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {!isEditing ? (
              <div className="mt-4">
                <h3 className="text-xl font-bold text-[#17191C]">
                  @{activeUser.username}
                </h3>
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full inline-block mt-1">
                  Online no Blá Blá
                </span>
              </div>
            ) : null}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-medium border border-rose-100 text-center">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-medium border border-emerald-100 text-center flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          )}

          {/* Edit Form */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                  Escolha seu avatar divertido (100% exclusivo)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2 p-2 bg-[#F6F7F9] rounded-2xl border border-gray-100">
                  {INVENTED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji.id}
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(emoji.url);
                        setCustomPhotoUrl('');
                      }}
                      title={emoji.name}
                      className={`relative rounded-xl p-1.5 aspect-square transition-all flex flex-col items-center justify-center cursor-pointer ${
                        selectedPhoto === emoji.url && !customPhotoUrl
                          ? 'bg-white ring-2 ring-blue-500 shadow-sm scale-105'
                          : 'opacity-75 hover:opacity-100 hover:bg-white/60 hover:scale-102'
                      }`}
                    >
                      <img src={emoji.url} alt={emoji.name} className="w-full h-full object-contain pointer-events-none" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                  Nome de usuário
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-[#F6F7F9] text-[#17191C] text-sm pl-8 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                    placeholder="novo_usuario"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                  Nova senha de 4 dígitos (opcional)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#F6F7F9] text-[#17191C] text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none tracking-widest transition-all"
                    placeholder="••••"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-[#17191C] font-semibold text-sm rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-sm rounded-2xl transition-all shadow-xs disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setNewUsername(activeUser.username);
                  setSelectedPhoto(activeUser.profile_photo);
                  setNewPin('');
                  setIsEditing(true);
                }}
                className="w-full py-3 px-4 bg-[#EAF2FF] hover:bg-blue-100 active:bg-blue-200 text-blue-600 font-semibold text-sm rounded-2xl transition-all text-center cursor-pointer"
              >
                Editar perfil
              </button>

              {/* Notification Settings & Test Box */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-100 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-tight">Notificações Blá Blá</p>
                      <p className="text-[11px] text-gray-500">Alertas na barra de status e toque</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider ${
                      getNotificationPermission() === 'granted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {getNotificationPermission() === 'granted' ? 'Ativadas' : 'Desativadas'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-0.5">
                  {getNotificationPermission() !== 'granted' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setErrorMsg(null);
                          const perm = await requestNotificationPermission();
                          if (perm === 'granted') {
                            setSuccessMsg('Notificações ativadas com sucesso!');
                            playNotificationSound();
                            sendBrowserNotification('Blá Blá', {
                              body: '🎉 Notificações do sistema ativadas!',
                              icon: activeUser.profile_photo || '/icon-192.png',
                              tag: 'perm_granted',
                            });
                            setTimeout(() => setSuccessMsg(null), 3500);
                          } else if (isIOS() && !isStandalone()) {
                            setSuccessMsg(
                              '📱 No iPhone: Toque no botão Compartilhar 📤 no Safari e escolha "Adicionar à Tela de Início" para ativar notificações na tela bloqueada.'
                            );
                            setTimeout(() => setSuccessMsg(null), 6000);
                          } else {
                            setErrorMsg('Permissão de notificação não foi concedida no navegador.');
                            setTimeout(() => setErrorMsg(null), 4000);
                          }
                        } catch {
                          setErrorMsg('Não foi possível solicitar permissão neste navegador.');
                          setTimeout(() => setErrorMsg(null), 4000);
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Ativar Notificações no Celular</span>
                    </button>
                  )}

                  {/* Immediate Status Bar Notification Test */}
                  <button
                    type="button"
                    onClick={async () => {
                      setErrorMsg(null);
                      // Play sound
                      playNotificationSound();

                      // Dispatch strictly to system notification tray / status bar formatted like WhatsApp
                      const sent = await sendBrowserNotification('@maria_silva', {
                        body: 'Oi! Tudo bem? Me avisa quando estiver livre para conversar! 👋',
                        icon: activeUser.profile_photo || '/icon-192.png',
                        tag: 'test_notification_whatsapp',
                      });

                      if (sent) {
                        setSuccessMsg('Notificação estilo WhatsApp enviada para a barra de status!');
                      } else if (isIOS() && !isStandalone()) {
                        setSuccessMsg('📱 No iPhone: Adicione o app à Tela de Início (📤) para receber na barra de status.');
                      } else {
                        setSuccessMsg('Toque sonoro disparado!');
                      }

                      setTimeout(() => setSuccessMsg(null), 4000);
                    }}
                    className="w-full py-2.5 px-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Testar Notificação WhatsApp na Barra</span>
                  </button>

                  {/* Scheduled test button for background/locked screen */}
                  <button
                    type="button"
                    disabled={scheduledCountdown !== null}
                    onClick={async () => {
                      setErrorMsg(null);
                      setScheduledCountdown(5);
                      setSuccessMsg('⏳ Bloqueie a tela ou saia do app agora! Notificação estilo WhatsApp em 5s...');

                      // Schedule in Service Worker
                      await scheduleBackgroundNotification(
                        '@carlos_souza',
                        {
                          body: 'E aí! Você viu a mensagem que te mandei antes? 👀',
                          icon: activeUser.profile_photo || '/icon-192.png',
                          tag: 'background_test_notif',
                        },
                        5000,
                      );

                      let current = 5;
                      const interval = setInterval(() => {
                        current -= 1;
                        if (current <= 0) {
                          clearInterval(interval);
                          setScheduledCountdown(null);
                          setSuccessMsg('Notificação WhatsApp enviada para a tela de bloqueio!');
                          setTimeout(() => setSuccessMsg(null), 4000);
                        } else {
                          setScheduledCountdown(current);
                        }
                      }, 1000);
                    }}
                    className="w-full py-2 px-3 bg-emerald-100/70 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <span>
                      {scheduledCountdown !== null
                        ? `⏳ Saia do app / Bloqueie a tela (${scheduledCountdown}s)...`
                        : '⏱️ Testar Mensagem na Barra com Tela Bloqueada (em 5s)'}
                    </span>
                  </button>
                </div>

                {/* iPhone / iOS Special PWA Guidance */}
                {isIOS() && !isStandalone() && (
                  <div className="pt-1.5 border-t border-emerald-100/80 text-[11px] text-emerald-900/90 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-xs shrink-0">📱</span>
                    <div className="flex-1">
                      <span className="font-semibold text-emerald-800">Dica para iPhone (iOS):</span> Para receber notificações na tela bloqueada, toque em Compartilhar <span className="font-bold">📤</span> no Safari e selecione <span className="font-bold">"Adicionar à Tela de Início"</span>.
                    </div>
                  </div>
                )}

                {/* Iframe tip if previewing */}
                {isInIframe() && !isIOS() && (
                  <div className="pt-1 border-t border-emerald-100/80 text-[11px] text-emerald-900/80 flex items-start gap-1.5">
                    <span className="text-xs shrink-0">💡</span>
                    <div className="flex-1">
                      <span>No modo preview (iframe), os navegadores bloqueiam notificações do sistema. </span>
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5"
                      >
                        Abrir em Nova Aba <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onLogout}
                className="w-full py-3 px-4 bg-gray-50 hover:bg-rose-50 active:bg-rose-100 text-rose-600 font-semibold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-100 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>

            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
