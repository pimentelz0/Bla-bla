// Collection of expressive, fun vector WhatsApp-style stickers (Figurinhas)

export interface Sticker {
  id: string;
  name: string;
  category: string;
  svgDataUri: string;
}

function makeSvgSticker(bgGradient: [string, string], emoji: string, caption: string, accentColor = '#FFFFFF'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="g_${emoji.charCodeAt(0) || '0'}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.15" />
      </filter>
    </defs>
    <rect x="8" y="8" width="184" height="184" rx="36" fill="url(#g_${emoji.charCodeAt(0) || '0'})" filter="url(#shadow)" stroke="#FFFFFF" stroke-width="4" />
    <text x="100" y="98" font-size="64" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    <rect x="20" y="132" width="160" height="38" rx="14" fill="#000000" fill-opacity="0.28" />
    <text x="100" y="156" font-size="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" fill="${accentColor}" text-anchor="middle" dominant-baseline="central">${caption}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STICKER_PACKS: { name: string; stickers: Sticker[] }[] = [
  {
    name: 'Expressões Populares',
    stickers: [
      {
        id: 'stk_eita',
        name: 'Eita!',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#FF512F', '#DD2476'], '😱', 'EITA NADA VER!'),
      },
      {
        id: 'stk_calma',
        name: 'Calma',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#11998e', '#38ef7d'], '🦆', 'CALMA CALABRESO'),
      },
      {
        id: 'stk_bomdia',
        name: 'Bom dia',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#F2994A', '#F2C94C'], '☕', 'BOM DIA FAMÍLIA'),
      },
      {
        id: 'stk_rir',
        name: 'Chorando de rir',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#F37335', '#FDC830'], '🤣', 'TÔ MORRENDO'),
      },
      {
        id: 'stk_olho',
        name: 'Tô de olho',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#4568DC', '#B06AB3'], '👀', 'TÔ DE OLHO HEIN'),
      },
      {
        id: 'stk_top',
        name: 'Top',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#f12711', '#f5af19'], '🔥', 'TOP DEMAIS!'),
      },
      {
        id: 'stk_valeu',
        name: 'Valeu',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#00b09b', '#96c93d'], '👍', 'VALEU, TÁ SALVO!'),
      },
      {
        id: 'stk_audio',
        name: 'Manda áudio',
        category: 'popular',
        svgDataUri: makeSvgSticker(['#654ea3', '#eaafc8'], '🎙️', 'MANDA ÁUDIO AÍ'),
      },
    ],
  },
  {
    name: 'Blá Blá Especiais',
    stickers: [
      {
        id: 'stk_coracao',
        name: 'Coração',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#ff758c', '#ff7eb3'], '💖', 'AMO VOCÊ'),
      },
      {
        id: 'stk_partiu',
        name: 'Partiu',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#3a7bd5', '#3a6073'], '🚀', 'PARTIU! FUI!'),
      },
      {
        id: 'stk_paz',
        name: 'Paz',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#4facfe', '#00f2fe'], '✌️', 'PAZ E AMOR'),
      },
      {
        id: 'stk_show',
        name: 'Show',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#fa709a', '#fee140'], '🎉', 'SHOW DE BOLA!'),
      },
      {
        id: 'stk_foco',
        name: 'Foco',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#8E2DE2', '#4A00E0'], '🎯', 'FOCO TOTAL'),
      },
      {
        id: 'stk_socorro',
        name: 'Socorro',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#eb3349', '#f45c43'], 'SOS', 'ALGUÉM ME SALVA'),
      },
      {
        id: 'stk_dormir',
        name: 'Dormir',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#2C3E50', '#4CA1AF'], '😴', 'FUI DORMIR...'),
      },
      {
        id: 'stk_segredo',
        name: 'Segredo',
        category: 'specials',
        svgDataUri: makeSvgSticker(['#0f2027', '#203a43'], '🤫', 'NÃO CONTA PRA NINGUÉM'),
      },
    ],
  },
];
