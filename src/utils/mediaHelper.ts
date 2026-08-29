import { MessageType } from '../types';

export interface ParsedMediaMessage {
  type: MessageType;
  content: string;
  url?: string;
  duration?: number;
  stickerId?: string;
}

export function parseMessageContent(raw: string): ParsedMediaMessage {
  if (!raw) return { type: 'text', content: '' };

  // Check JSON format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'image' && parsed.url) {
        return {
          type: 'image',
          content: parsed.caption || '',
          url: parsed.url,
        };
      }
      if (parsed.type === 'audio' && parsed.url) {
        return {
          type: 'audio',
          content: '',
          url: parsed.url,
          duration: parsed.duration || 0,
        };
      }
      if (parsed.type === 'sticker' && parsed.url) {
        return {
          type: 'sticker',
          content: parsed.name || 'Figurinha',
          url: parsed.url,
          stickerId: parsed.id,
        };
      }
    } catch {
      // Not JSON, continue below
    }
  }

  // Tag prefixes
  if (raw.startsWith('[IMG]') && raw.endsWith('[/IMG]')) {
    const url = raw.slice(5, -6);
    return { type: 'image', content: '', url };
  }

  if (raw.startsWith('[AUDIO]') && raw.endsWith('[/AUDIO]')) {
    const payload = raw.slice(7, -8);
    const [url, durStr] = payload.split('|');
    return { type: 'audio', content: '', url, duration: parseFloat(durStr) || 0 };
  }

  if (raw.startsWith('[STICKER]') && raw.endsWith('[/STICKER]')) {
    const url = raw.slice(9, -10);
    return { type: 'sticker', content: 'Figurinha', url };
  }

  // Plain text
  return { type: 'text', content: raw };
}

export function formatMediaSummary(raw: string): string {
  const parsed = parseMessageContent(raw);
  switch (parsed.type) {
    case 'image':
      return parsed.content ? `📷 Foto: ${parsed.content}` : '📷 Foto';
    case 'audio': {
      const mins = Math.floor((parsed.duration || 0) / 60);
      const secs = Math.floor((parsed.duration || 0) % 60);
      return `🎤 Áudio (${mins}:${secs < 10 ? '0' : ''}${secs})`;
    }
    case 'sticker':
      return '🎭 Figurinha';
    default:
      return raw;
  }
}

export function formatAudioDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}
