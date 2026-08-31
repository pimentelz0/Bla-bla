import React, { useState } from 'react';
import { Logo } from './Logo';
import { api } from '../services/api';
import { User } from '../types';
import { ArrowRight, UserPlus, LogIn, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INVENTED_EMOJIS, DEFAULT_AVATAR_URL } from '../utils/customAvatars';
import {
  requestNotificationPermission,
  subscribeUserToWebPush,
  isNotificationSupported,
  getNotificationPermission,
} from '../utils/notifications';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePinChange = (val: string) => {
    const numeric = val.replace(/\D/g, '').slice(0, 4);
    setPin(numeric);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMsg('Informe o nome de usuário.');
      return;
    }

    if (pin.length !== 4) {
      setErrorMsg('A senha deve conter exatamente 4 números.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(cleanUsername, pin);
        if (res && res.user) {
          onShowToast(`Bem-vindo(a) de volta, @${res.user.username || cleanUsername}!`, 'success');
          // Request notification permission and subscribe
          if (isNotificationSupported() && getNotificationPermission() === 'default') {
            try {
              await requestNotificationPermission();
            } catch {}
          }
          subscribeUserToWebPush().catch(() => {});
          onAuthSuccess(res.user);
        } else {
          throw new Error('Não foi possível entrar. Tente novamente.');
        }
      } else {
        const res = await api.register(cleanUsername, pin, selectedAvatar);
        if (res && res.user) {
          onShowToast(`Conta criada com sucesso! Olá, @${res.user.username || cleanUsername}!`, 'success');
          // Request notification permission and subscribe
          if (isNotificationSupported() && getNotificationPermission() === 'default') {
            try {
              await requestNotificationPermission();
            } catch {}
          }
          subscribeUserToWebPush().catch(() => {});
          onAuthSuccess(res.user);
        } else {
          throw new Error('Não foi possível criar a conta. Tente novamente.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar. Verifique seus dados.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F7F9] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-gray-200/50 border border-gray-100"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Logo size="lg" className="mb-2" />
            <p className="text-sm text-[#7A7F87] font-medium">
              {mode === 'login'
                ? 'Converse do seu jeito.'
                : 'Crie seu Blá Blá e converse em tempo real.'}
            </p>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200/80 shadow-xs space-y-1 text-left"
            >
              <div className="flex items-start gap-2">
                <span className="text-rose-500 font-bold shrink-0 mt-0.5">⚠️</span>
                <div className="flex-1 break-words whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {errorMsg}
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                  Escolha um avatar inicial
                </label>
                <div className="flex items-center justify-between gap-1.5 p-1.5 bg-[#F6F7F9] rounded-2xl border border-gray-100/80 overflow-x-auto no-scrollbar">
                  {INVENTED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji.id}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji.url)}
                      title={emoji.name}
                      className={`relative w-9 h-9 shrink-0 rounded-xl p-1 transition-all flex items-center justify-center cursor-pointer ${
                        selectedAvatar === emoji.url
                          ? 'bg-white ring-2 ring-blue-500 shadow-xs scale-105'
                          : 'opacity-70 hover:opacity-100 hover:bg-white/60 hover:scale-105'
                      }`}
                    >
                      <img
                        src={emoji.url}
                        alt={emoji.name}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                {mode === 'register' ? 'Nome de usuário' : 'Nome de usuário'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7F87] font-semibold text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                  placeholder={mode === 'register' ? 'seunome' : 'usuario'}
                  className="w-full bg-[#F6F7F9] text-[#17191C] text-sm pl-8 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all placeholder-[#7A7F87]"
                />
              </div>
              {mode === 'register' && (
                <span className="text-[11px] text-[#7A7F87] mt-1 block">
                  Apenas letras, números e _ (sem espaços)
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7A7F87] uppercase tracking-wider mb-1.5">
                Senha de 4 dígitos
              </label>

              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="w-full bg-[#F6F7F9] text-[#17191C] text-center tracking-[0.6em] font-mono text-lg py-2.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all placeholder-gray-300"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || pin.length !== 4}
              className="w-full py-3.5 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-semibold text-sm rounded-2xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <span>Entrar</span>
                  <LogIn className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Criar conta</span>
                  <UserPlus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            {mode === 'login' ? (
              <p className="text-xs text-[#7A7F87]">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('register');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline ml-1"
                >
                  Criar conta
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#7A7F87]">
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('login');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline ml-1"
                >
                  Entrar
                </button>
              </p>
            )}
          </div>

        </motion.div>
      </div>
    </div>
  );
};

