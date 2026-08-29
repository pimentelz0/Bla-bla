import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Database, CheckCircle2, AlertTriangle, Copy, Check, X, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<{
    supabase_url: string;
    connected: boolean;
    tables_exist: boolean;
    error?: string;
    schema_sql: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSupabaseStatus();
      setStatus(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!status?.schema_sql) return;
    navigator.clipboard.writeText(status.schema_sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#17191C] text-base">Integração Supabase</h2>
                <p className="text-xs text-[#7A7F87]">Armazenamento e sincronização em nuvem</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#7A7F87] uppercase tracking-wider">
                  Status da Conexão
                </span>
                <button
                  onClick={loadStatus}
                  disabled={isLoading}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">URL do Projeto:</span>
                  <span className="font-mono text-gray-800 break-all">{status?.supabase_url}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Persistência Local:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Desativada (100% Supabase)
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-gray-500">Tabelas no Supabase:</span>
                  {status?.tables_exist ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Prontas e ativas
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-100/60 px-2 py-0.5 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" /> Execute o script SQL abaixo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Instruction if tables are not yet created */}
            {!status?.tables_exist && (
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  💡 Como configurar as tabelas no Supabase:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Clique em <strong>Copiar SQL</strong> abaixo.</li>
                  <li>
                    Abra o{' '}
                    <a
                      href="https://supabase.com/dashboard/project/myoicywulrrzfohlsjfe/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-semibold inline-flex items-center gap-0.5 text-blue-700 hover:text-blue-900"
                    >
                      SQL Editor do seu Supabase <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </li>
                  <li>Cole o script e clique no botão verde <strong>Run</strong>.</li>
                </ol>
              </div>
            )}

            {/* SQL Script Block */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Script SQL do Banco:</span>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3 bg-gray-900 text-gray-100 text-[11px] rounded-2xl font-mono overflow-x-auto max-h-48 border border-gray-800">
                {status?.schema_sql}
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-[#F6F7F9] flex items-center justify-between">
            <a
              href="https://supabase.com/dashboard/project/myoicywulrrzfohlsjfe"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-[#7A7F87] hover:text-blue-600 flex items-center gap-1 transition-colors"
            >
              Abrir Dashboard do Supabase <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-[#17191C] rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
