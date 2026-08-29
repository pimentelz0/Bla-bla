/**
 * Emojis Originais e Engraçados (100% inventados e livres de direitos autorais)
 * Formato Vetorial SVG em Data-URI para carregamento instantâneo e resolução infinita.
 */

function encodeSvg(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export interface InventedEmojiAvatar {
  id: string;
  name: string;
  label: string;
  url: string;
}

export const INVENTED_EMOJIS: InventedEmojiAvatar[] = [
  {
    id: 'zoio_zonzo',
    name: 'Zóio Zonzo',
    label: 'Ciclope amarelo com dente torto e anteninha',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_zoio" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFE033"/>
            <stop offset="100%" stop-color="#FFB300"/>
          </linearGradient>
        </defs>
        <!-- Fundo suave -->
        <rect width="100" height="100" rx="50" fill="#FFF9DB"/>
        <!-- Antena doida -->
        <path d="M 50 25 Q 56 12 48 8" fill="none" stroke="#D97706" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="48" cy="7" r="4.5" fill="#EF4444"/>
        <!-- Corpo Principal -->
        <circle cx="50" cy="55" r="35" fill="url(#bg_zoio)" stroke="#F59E0B" stroke-width="2.5"/>
        <!-- Bochechas rosadas -->
        <circle cx="27" cy="62" r="5" fill="#F43F5E" opacity="0.4"/>
        <circle cx="73" cy="62" r="5" fill="#F43F5E" opacity="0.4"/>
        <!-- Olho Gigante no centro -->
        <circle cx="50" cy="46" r="15" fill="#FFFFFF" stroke="#D97706" stroke-width="2"/>
        <!-- Pupila olhando pro canto -->
        <circle cx="53" cy="43" r="7" fill="#1E293B"/>
        <circle cx="56" cy="41" r="2.5" fill="#FFFFFF"/>
        <!-- Boca rindo torta -->
        <path d="M 36 67 Q 50 82 64 67" fill="#881337" stroke="#701A75" stroke-width="2"/>
        <path d="M 40 68 Q 50 80 60 68" fill="#BE123C"/>
        <!-- Dente torto engraçado -->
        <rect x="47" y="67" width="5" height="5.5" rx="1" fill="#FFFFFF"/>
        <!-- Sobrancelha zombeteira -->
        <path d="M 40 27 Q 52 23 60 29" fill="none" stroke="#B45309" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'alien_debochado',
    name: 'Alien Zork',
    label: 'Extraterrestre verde estiloso com óculos escuros',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_alien" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4ADE80"/>
            <stop offset="100%" stop-color="#16A34A"/>
          </linearGradient>
          <linearGradient id="glass_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#9333EA"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#DCFCE7"/>
        <!-- Antenas duplas com pontas de estrela -->
        <path d="M 35 30 Q 22 18 20 12" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round"/>
        <circle cx="19" cy="11" r="4" fill="#FACC15"/>
        <path d="M 65 30 Q 78 18 80 12" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round"/>
        <circle cx="81" cy="11" r="4" fill="#FACC15"/>
        <!-- Cabeça oval alienígena -->
        <ellipse cx="50" cy="56" rx="36" ry="32" fill="url(#bg_alien)" stroke="#15803D" stroke-width="2"/>
        <!-- Óculos escuros futuristas curvados -->
        <path d="M 22 46 Q 36 41 50 46 Q 64 41 78 46 Q 76 60 62 60 Q 50 56 38 60 Q 24 60 22 46 Z" fill="url(#glass_grad)" stroke="#0F172A" stroke-width="2.5"/>
        <!-- Brilho no óculos -->
        <path d="M 28 47 L 36 45" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
        <path d="M 56 47 L 64 45" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
        <!-- Sorrisinho de lado zombeteiro -->
        <path d="M 44 72 Q 54 77 64 69" fill="none" stroke="#064E3B" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'gato_espiral',
    name: 'Gato Zonzo',
    label: 'Felino roxo com olhos hipnóticos em espiral',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_cat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#C084FC"/>
            <stop offset="100%" stop-color="#7E22CE"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#F3E8FF"/>
        <!-- Orelhas pontudas de gato -->
        <polygon points="20,44 26,16 45,34" fill="#7E22CE" stroke="#581C87" stroke-width="2"/>
        <polygon points="25,38 29,22 41,33" fill="#F472B6"/>
        <polygon points="80,44 74,16 55,34" fill="#7E22CE" stroke="#581C87" stroke-width="2"/>
        <polygon points="75,38 71,22 59,33" fill="#F472B6"/>
        <!-- Rosto redondo -->
        <circle cx="50" cy="56" r="34" fill="url(#bg_cat)" stroke="#581C87" stroke-width="2.5"/>
        <!-- Bochechas rosadas -->
        <circle cx="28" cy="64" r="5" fill="#FB7185" opacity="0.5"/>
        <circle cx="72" cy="64" r="5" fill="#FB7185" opacity="0.5"/>
        <!-- Olho Esquerdo Espiral -->
        <circle cx="37" cy="48" r="10" fill="#FEF08A" stroke="#7E22CE" stroke-width="1.5"/>
        <path d="M 37 48 m -6,0 a 6,6 0 1,0 12,0 a 4,4 0 1,0 -8,0 a 2,2 0 1,0 4,0" fill="none" stroke="#6B21A8" stroke-width="2" stroke-linecap="round"/>
        <!-- Olho Direito Espiral -->
        <circle cx="63" cy="48" r="10" fill="#FEF08A" stroke="#7E22CE" stroke-width="1.5"/>
        <path d="M 63 48 m -6,0 a 6,6 0 1,0 12,0 a 4,4 0 1,0 -8,0 a 2,2 0 1,0 4,0" fill="none" stroke="#6B21A8" stroke-width="2" stroke-linecap="round"/>
        <!-- Focinho e Língua para fora -->
        <polygon points="48,60 52,60 50,63" fill="#F472B6"/>
        <path d="M 44 65 Q 50 69 56 65" fill="none" stroke="#3B0764" stroke-width="2" stroke-linecap="round"/>
        <!-- Língua boba -->
        <path d="M 48 67 Q 51 77 55 74 Q 57 67 53 66 Z" fill="#FB7185" stroke="#E11D48" stroke-width="1.5"/>
        <!-- Bigodinhos curvos -->
        <path d="M 22 58 L 12 55 M 22 63 L 11 65" stroke="#DDD6FE" stroke-width="2" stroke-linecap="round"/>
        <path d="M 78 58 L 88 55 M 78 63 L 89 65" stroke="#DDD6FE" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'batata_bigode',
    name: 'Dom Batata',
    label: 'Tubérculo dourado refinado com bigode cacheado',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_potato" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FBBF24"/>
            <stop offset="100%" stop-color="#D97706"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#FEF3C7"/>
        <!-- Mini cartola chique -->
        <path d="M 40 24 L 60 24 L 58 12 L 42 12 Z" fill="#1E293B"/>
        <rect x="33" y="23" width="34" height="4" rx="2" fill="#0F172A"/>
        <rect x="42" y="19" width="16" height="3" fill="#EF4444"/>
        <!-- Formato da batata irregular charmosa -->
        <path d="M 30 40 Q 24 60 35 78 Q 50 88 68 76 Q 78 58 70 38 Q 60 28 44 30 Q 34 32 30 40 Z" fill="url(#bg_potato)" stroke="#B45309" stroke-width="2.5"/>
        <!-- Olhos brilhantes expressivos -->
        <circle cx="42" cy="46" r="6" fill="#1E293B"/>
        <circle cx="44" cy="44" r="2" fill="#FFFFFF"/>
        <circle cx="60" cy="46" r="6" fill="#1E293B"/>
        <circle cx="62" cy="44" r="2" fill="#FFFFFF"/>
        <!-- Bochechas -->
        <circle cx="34" cy="54" r="4.5" fill="#F87171" opacity="0.6"/>
        <circle cx="68" cy="54" r="4.5" fill="#F87171" opacity="0.6"/>
        <!-- Bigode estiloso de cavalheiro -->
        <path d="M 51 56 C 45 51 34 54 36 62 C 43 62 48 58 51 60 C 54 58 59 62 66 62 C 68 54 57 51 51 56 Z" fill="#451A03" stroke="#270B02" stroke-width="1.5"/>
        <!-- Monóculo dourado no olho direito -->
        <circle cx="60" cy="46" r="7.5" fill="none" stroke="#F59E0B" stroke-width="2"/>
        <path d="M 68 47 Q 73 58 71 70" fill="none" stroke="#F59E0B" stroke-width="1.5"/>
      </svg>
    `),
  },
  {
    id: 'robo_pifado',
    name: 'Robô Beep',
    label: 'Robô retrô com olhos X e sorriso zig-zag',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_robo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38BDF8"/>
            <stop offset="100%" stop-color="#0284C7"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#E0F2FE"/>
        <!-- Antena em mola -->
        <path d="M 50 26 Q 44 20 56 16 Q 44 12 50 8" fill="none" stroke="#0369A1" stroke-width="3" stroke-linecap="round"/>
        <circle cx="50" cy="7" r="4.5" fill="#F43F5E"/>
        <!-- Parafusos laterais da orelha -->
        <rect x="14" y="47" width="6" height="12" rx="2" fill="#64748B"/>
        <rect x="80" y="47" width="6" height="12" rx="2" fill="#64748B"/>
        <!-- Cabeça quadrada arredondada -->
        <rect x="19" y="26" width="62" height="56" rx="14" fill="url(#bg_robo)" stroke="#0369A1" stroke-width="2.5"/>
        <!-- Olho esquerdo em X (pane) -->
        <g stroke="#FDE047" stroke-width="3.5" stroke-linecap="round">
          <line x1="31" y1="41" x2="41" y2="51"/>
          <line x1="41" y1="41" x2="31" y2="51"/>
        </g>
        <!-- Olho direito em círculo luminoso -->
        <circle cx="61" cy="46" r="7" fill="#0F172A" stroke="#FDE047" stroke-width="2.5"/>
        <circle cx="61" cy="46" r="3" fill="#22C55E"/>
        <!-- Boca zig-zag metálica -->
        <path d="M 32 68 L 38 63 L 44 68 L 50 63 L 56 68 L 62 63 L 68 68" fill="none" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `),
  },
  {
    id: 'polvo_biruta',
    name: 'Octo Maluco',
    label: 'Polvo coral com tentáculos dançantes',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_octo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FB7185"/>
            <stop offset="100%" stop-color="#E11D48"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#FFE4E6"/>
        <!-- Cabeça redonda do polvo -->
        <path d="M 22 52 C 22 28 78 28 78 52 C 78 66 70 72 50 72 C 30 72 22 66 22 52 Z" fill="url(#bg_octo)" stroke="#BE123C" stroke-width="2"/>
        <!-- Tentáculos enrolados na base -->
        <path d="M 24 68 Q 20 84 30 82 Q 38 78 36 68" fill="none" stroke="#E11D48" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M 38 70 Q 42 86 50 82 Q 54 78 52 70" fill="none" stroke="#E11D48" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M 52 70 Q 60 86 68 82 Q 74 76 72 68" fill="none" stroke="#E11D48" stroke-width="4.5" stroke-linecap="round"/>
        <!-- Olhos vesgos engraçados -->
        <circle cx="38" cy="46" r="9" fill="#FFFFFF" stroke="#BE123C" stroke-width="1.5"/>
        <circle cx="42" cy="46" r="4.5" fill="#1E293B"/>
        <circle cx="62" cy="46" r="9" fill="#FFFFFF" stroke="#BE123C" stroke-width="1.5"/>
        <circle cx="58" cy="46" r="4.5" fill="#1E293B"/>
        <!-- Boca redondinha espantada -->
        <ellipse cx="50" cy="59" rx="4" ry="6" fill="#881337" stroke="#4C0519" stroke-width="1.5"/>
        <!-- Bolhas flutuantes -->
        <circle cx="78" cy="26" r="3.5" fill="#BAE6FD" opacity="0.8"/>
        <circle cx="84" cy="18" r="2.5" fill="#BAE6FD" opacity="0.8"/>
      </svg>
    `),
  },
  {
    id: 'dino_bobo',
    name: 'Dino Rexinho',
    label: 'Dinossauro verde menta banguela e alegre',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_dino" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34D399"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#D1FAE5"/>
        <!-- Espinhos no topo da cabeça -->
        <polygon points="34,26 40,14 46,26" fill="#F97316"/>
        <polygon points="46,24 52,12 58,24" fill="#F97316"/>
        <polygon points="58,26 64,16 70,28" fill="#F97316"/>
        <!-- Rosto do Dino -->
        <path d="M 24 52 C 24 30 76 30 76 52 C 76 72 70 78 50 78 C 30 78 24 72 24 52 Z" fill="url(#bg_dino)" stroke="#047857" stroke-width="2.5"/>
        <!-- Narinas fofas de dinossauro -->
        <ellipse cx="44" cy="58" rx="2" ry="3" fill="#065F46"/>
        <ellipse cx="56" cy="58" rx="2" ry="3" fill="#065F46"/>
        <!-- Olhos arregalados e felizes -->
        <circle cx="36" cy="42" r="8" fill="#FFFFFF" stroke="#047857" stroke-width="1.5"/>
        <circle cx="37" cy="41" r="4" fill="#0F172A"/>
        <circle cx="39" cy="39" r="1.5" fill="#FFFFFF"/>
        <circle cx="64" cy="42" r="8" fill="#FFFFFF" stroke="#047857" stroke-width="1.5"/>
        <circle cx="63" cy="41" r="4" fill="#0F172A"/>
        <circle cx="65" cy="39" r="1.5" fill="#FFFFFF"/>
        <!-- Bochechas vermelhas -->
        <circle cx="28" cy="52" r="4.5" fill="#F43F5E" opacity="0.6"/>
        <circle cx="72" cy="52" r="4.5" fill="#F43F5E" opacity="0.6"/>
        <!-- Boca com 1 dente fofo para cima -->
        <path d="M 36 66 Q 50 74 64 66" fill="none" stroke="#064E3B" stroke-width="3" stroke-linecap="round"/>
        <polygon points="48,68 52,68 50,62" fill="#FFFFFF" stroke="#064E3B" stroke-width="1"/>
      </svg>
    `),
  },
  {
    id: 'monstro_felpudo',
    name: 'Bolota Laranja',
    label: 'Monstrinho fofo laranja com chifres amarelos e três olhos',
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg_monster" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FB923C"/>
            <stop offset="100%" stop-color="#EA580C"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="#FFEDD5"/>
        <!-- Chifrinhos tortos -->
        <path d="M 28 32 Q 20 18 16 20 Q 24 30 28 36" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/>
        <path d="M 72 32 Q 80 18 84 20 Q 76 30 72 36" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/>
        <!-- Corpo redondo fofo -->
        <circle cx="50" cy="56" r="34" fill="url(#bg_monster)" stroke="#C2410C" stroke-width="2.5"/>
        <!-- 3 Olhos de tamanhos diferentes -->
        <circle cx="34" cy="46" r="7.5" fill="#FFFFFF" stroke="#9A3412" stroke-width="1.5"/>
        <circle cx="34" cy="46" r="3.5" fill="#1E293B"/>
        <circle cx="50" cy="40" r="9.5" fill="#FFFFFF" stroke="#9A3412" stroke-width="1.5"/>
        <circle cx="50" cy="40" r="4.5" fill="#1E293B"/>
        <circle cx="66" cy="46" r="7.5" fill="#FFFFFF" stroke="#9A3412" stroke-width="1.5"/>
        <circle cx="66" cy="46" r="3.5" fill="#1E293B"/>
        <!-- Sorrisão exibindo presinhas -->
        <path d="M 32 64 Q 50 82 68 64 Z" fill="#7C2D12" stroke="#431407" stroke-width="2"/>
        <!-- Dentinhos / presinhas brancas -->
        <polygon points="38,64 42,64 40,69" fill="#FFFFFF"/>
        <polygon points="58,64 62,64 60,69" fill="#FFFFFF"/>
      </svg>
    `),
  },
];

export const DEFAULT_AVATAR_URL = INVENTED_EMOJIS[0].url;
