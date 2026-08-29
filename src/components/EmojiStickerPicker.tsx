import React, { useState } from 'react';
import { EMOJI_CATEGORIES } from '../utils/emojis';
import { STICKER_PACKS, Sticker } from '../utils/stickers';
import { Smile, Sparkles, X } from 'lucide-react';

interface EmojiStickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (sticker: Sticker) => void;
  onClose: () => void;
}

export const EmojiStickerPicker: React.FC<EmojiStickerPickerProps> = ({
  onSelectEmoji,
  onSelectSticker,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'emojis' | 'stickers'>('emojis');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('smilies');
  const [selectedStickerPack, setSelectedStickerPack] = useState<number>(0);

  return (
    <div className="bg-white border-t border-gray-200 flex flex-col h-64 select-none">
      {/* Top Header & Tab Switcher */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-[#F6F7F9]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('emojis')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'emojis'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-[#7A7F87] hover:text-[#17191C]'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>Emojis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'stickers'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-[#7A7F87] hover:text-[#17191C]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Figurinhas</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'emojis' ? (
          <div>
            {/* Category Nav */}
            <div className="flex items-center gap-1 mb-2 pb-1 border-b border-gray-100 overflow-x-auto no-scrollbar">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedEmojiCategory(cat.id)}
                  className={`p-1.5 rounded-lg text-base transition-colors shrink-0 ${
                    selectedEmojiCategory === cat.id
                      ? 'bg-blue-50 text-blue-600 scale-110'
                      : 'opacity-70 hover:opacity-100 hover:bg-gray-100'
                  }`}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>

            {/* Emoji Grid */}
            {EMOJI_CATEGORIES.filter((cat) => cat.id === selectedEmojiCategory).map((cat) => (
              <div key={cat.id}>
                <div className="text-[11px] font-semibold text-[#7A7F87] uppercase tracking-wider mb-2">
                  {cat.name}
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                  {cat.emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectEmoji(emoji)}
                      className="text-2xl p-1.5 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-transform active:scale-90 flex items-center justify-center cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Sticker Pack Tabs */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
              {STICKER_PACKS.map((pack, idx) => (
                <button
                  key={pack.name}
                  type="button"
                  onClick={() => setSelectedStickerPack(idx)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    selectedStickerPack === idx
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pack.name}
                </button>
              ))}
            </div>

            {/* Stickers Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {STICKER_PACKS[selectedStickerPack].stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => onSelectSticker(sticker)}
                  className="p-1 rounded-2xl bg-[#F6F7F9] hover:bg-blue-50 active:scale-95 transition-all border border-gray-100 flex flex-col items-center justify-center group cursor-pointer"
                  title={`Enviar ${sticker.name}`}
                >
                  <img
                    src={sticker.svgDataUri}
                    alt={sticker.name}
                    className="w-16 h-16 object-contain pointer-events-none group-hover:scale-105 transition-transform"
                  />
                  <span className="text-[10px] font-medium text-gray-500 truncate mt-1 w-full text-center">
                    {sticker.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
