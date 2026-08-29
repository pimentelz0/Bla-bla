import React, { useState, useEffect } from 'react';
import { SearchUserResult } from '../types';
import { api } from '../services/api';
import { Avatar } from './Avatar';
import { Search, X, MessageSquarePlus, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: SearchUserResult) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      return;
    }

    const trimmed = searchQuery.trim().replace(/^@/, '');
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const users = await api.searchUsers(trimmed);
        setResults(users);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[#17191C] text-base leading-none">
                Pesquisar pessoas
              </h2>
              <span className="text-[12px] text-[#7A7F87]">
                Encontre amigos para conversar
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100 bg-[#F6F7F9]/50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite um nome de usuário..."
              className="w-full bg-white text-[#17191C] placeholder-[#7A7F87] text-sm pl-10 pr-10 py-2.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Buscando usuários...</span>
            </div>
          ) : !searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                <Search className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm text-[#17191C]">
                Buscar usuários
              </p>
              <p className="text-xs text-[#7A7F87] mt-1 max-w-xs">
                Digite o @nome do usuário que você deseja encontrar para iniciar uma conversa.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-2">
                <Search className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm text-[#17191C]">
                Nenhum usuário encontrado.
              </p>
              <p className="text-xs text-[#7A7F87] mt-1 max-w-xs">
                Verifique a ortografia do nome ou convide seu amigo para criar uma conta.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((user) => (
                <div
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#EAF2FF]/60 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={user.profile_photo}
                      name={user.username}
                      size="md"
                      isOnline={user.is_online}
                      showStatus
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-[#17191C] group-hover:text-blue-600 truncate transition-colors">
                        @{user.username}
                      </span>
                      <span className="text-xs text-[#7A7F87] flex items-center gap-1">
                        {user.is_online ? (
                          <span className="text-emerald-600 font-medium">online</span>
                        ) : (
                          'Blá Blá'
                        )}
                      </span>
                    </div>
                  </div>

                  <button className="px-3.5 py-1.5 bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white rounded-xl text-xs font-semibold transition-all shadow-2xs">
                    Conversar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
