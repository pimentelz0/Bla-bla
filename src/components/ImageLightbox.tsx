import React from 'react';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageLightboxProps {
  imageUrl: string | null;
  caption?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  imageUrl,
  caption,
  onClose,
}) => {
  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `bla_bla_foto_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-between p-4"
        onClick={onClose}
      >
        {/* Top Controls */}
        <div
          className="w-full flex items-center justify-between text-white p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-gray-300">Visualização de Foto</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              title="Baixar imagem"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Center Image */}
        <div
          className="flex-1 flex items-center justify-center max-w-4xl max-h-[80vh] w-full p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={imageUrl}
            alt="Foto"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>

        {/* Bottom Caption */}
        {caption ? (
          <div
            className="bg-black/60 text-white px-4 py-2 rounded-xl text-sm max-w-lg text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {caption}
          </div>
        ) : (
          <div />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
