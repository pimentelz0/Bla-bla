import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'chat' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showStatus?: boolean;
  className?: string;
  id?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  showStatus = false,
  className = '',
  id,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    chat: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base', // ~50px
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  const statusSizes = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-2',
    chat: 'w-2.5 h-2.5 ring-2',
    md: 'w-3 h-3 ring-2',
    lg: 'w-4 h-4 ring-2',
    xl: 'w-5 h-5 ring-4',
  };

  const initial = (name || '?').replace(/^@/, '').charAt(0).toUpperCase();

  // Subtle pleasing background color based on name
  const bgColors = [
    'bg-blue-100 text-blue-700',
    'bg-sky-100 text-sky-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];
  const charCode = name ? name.charCodeAt(0) : 0;
  const colorClass = bgColors[charCode % bgColors.length];

  return (
    <div id={id} className={`relative shrink-0 select-none ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold transition-all ${
          !src || imgError ? colorClass : 'bg-gray-100'
        }`}
      >
        {src && !imgError ? (
          <img
            src={src}
            alt={name}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {showStatus && isOnline && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-white ${statusSizes[size]}`}
          title="Online"
        />
      )}
    </div>
  );
};
