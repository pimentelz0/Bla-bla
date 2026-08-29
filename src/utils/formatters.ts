export function formatMessageTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatChatListTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ontem';
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatLastSeen(isOnline?: boolean, lastSeenIso?: string): string {
  if (isOnline) {
    return 'online';
  }
  if (!lastSeenIso) return '';

  const date = new Date(lastSeenIso);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMins < 2) return 'online';
  if (diffMins < 60) return `visto há ${diffMins} min`;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `visto hoje às ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `visto ontem às ${timeStr}`;
  }

  return `visto em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}
