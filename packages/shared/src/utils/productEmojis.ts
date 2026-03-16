// ─── Product Emoji Mapping ────────────────────────────────────────────────────

const CATEGORY_EMOJIS: Record<string, string> = {
  'Pizzas': '🍕',
  'Hamburguesas': '🍔',
  'Chuzos': '🥩',
  'Pizza Burguer': '🍕',
  'Tortiburger': '🌯',
  'Calzones': '🥟',
  'Bebidas': '🥤',
  'Adiciones': '➕',
  'Otros': '🍽️',
};

const NAME_EMOJIS: [RegExp, string][] = [
  [/pizza/i, '🍕'],
  [/hamburgues/i, '🍔'],
  [/chuzo/i, '🥩'],
  [/salchipapa/i, '🍟'],
  [/papas/i, '🍟'],
  [/perro/i, '🌭'],
  [/lasa[ñn]a/i, '🧆'],
  [/coca.?cola|gaseosa/i, '🥤'],
  [/jugo/i, '🧃'],
  [/limonada/i, '🍋'],
  [/pan de ajo/i, '🧄'],
  [/tocineta|bacon/i, '🥓'],
  [/queso/i, '🧀'],
  [/ensalada/i, '🥗'],
  [/calzone/i, '🥟'],
  [/tortiburger/i, '🌯'],
  [/arepa/i, '🫓'],
  [/pollo/i, '🍗'],
  [/mazorca/i, '🌽'],
];

const DEFAULT_EMOJI = '🍽️';

/**
 * Get the emoji for a product.
 * Priority: custom emoji > name match > category match > default
 */
export function getProductEmoji(
  productoNombre: string,
  categoria?: string,
  customEmoji?: string | null,
): string {
  // 1. Custom emoji (set by user in admin)
  if (customEmoji) return customEmoji;

  // 2. Match by product name
  for (const [regex, emoji] of NAME_EMOJIS) {
    if (regex.test(productoNombre)) return emoji;
  }

  // 3. Match by category
  if (categoria && CATEGORY_EMOJIS[categoria]) {
    return CATEGORY_EMOJIS[categoria];
  }

  return DEFAULT_EMOJI;
}

/**
 * Get the emoji for a category.
 */
export function getCategoryEmoji(categoria: string): string {
  return CATEGORY_EMOJIS[categoria] || DEFAULT_EMOJI;
}
