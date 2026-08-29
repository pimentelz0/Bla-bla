import React, { useState, useRef } from 'react';
import { User } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';
import { X, Camera, LogOut, Key, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { INVENTED_EMOJIS } from '../utils/customAvatars';

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
