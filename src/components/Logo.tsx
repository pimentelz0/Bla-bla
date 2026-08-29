import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  id?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  id,
}) => {
  const titleSizes = {
    sm: 'text-lg tracking-tight',
    md: 'text-2xl tracking-tight',
    lg: 'text-3xl sm:text-4xl tracking-tight font-bold',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  return (
    <div id={id} className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0`}
      >
        {/* Custom Minimalist Blá Blá speech waves glyph */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4/6 h-4/6"
        >
          <path d="M4 12h8" />
          <path d="M4 8h12" />
          <path d="M4 16h5" />
          <circle cx="18" cy="14" r="2" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className={`font-bold text-[#17191C] leading-none ${titleSizes[size]}`}>
          Blá <span className="text-blue-500">Blá</span>
        </span>
        {showSubtitle && (
          <span className="text-xs text-[#7A7F87] font-normal mt-1">
            Converse do seu jeito.
          </span>
        )}
      </div>
    </div>
  );
};
