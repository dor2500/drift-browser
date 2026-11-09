// Colour themes layered on top of a browser style. Each sets the window and
// page backgrounds and an accent; the style still decides layout and shapes.
export interface ColorTheme {
  id: string;
  name: string;
  accent: string;
  /** Window / sidebar / tab strip. */
  bg: string;
  /** Behind pages, toolbars and panels. */
  surface: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: 'ocean', name: 'Ocean', accent: '#4fb3ff', bg: '#062a4a', surface: '#0b3558' },
  { id: 'midnight', name: 'Midnight', accent: '#8aa4ff', bg: '#0b0d14', surface: '#141826' },
  { id: 'forest', name: 'Forest', accent: '#7bd88f', bg: '#0c1a12', surface: '#13261b' },
  { id: 'rose', name: 'Rosé', accent: '#f5a0c0', bg: '#1a0f15', surface: '#26161f' },
  { id: 'sunset', name: 'Sunset', accent: '#ff9e64', bg: '#1d1210', surface: '#2a1a15' },
  { id: 'nord', name: 'Nord', accent: '#88c0d0', bg: '#242933', surface: '#2e3440' },
  { id: 'dracula', name: 'Dracula', accent: '#bd93f9', bg: '#1e1f29', surface: '#282a36' },
  { id: 'catppuccin', name: 'Catppuccin Mocha', accent: '#cba6f7', bg: '#11111b', surface: '#1e1e2e' },
  { id: 'tokyo-night', name: 'Tokyo Night', accent: '#7aa2f7', bg: '#16161e', surface: '#1a1b26' },
  { id: 'gruvbox', name: 'Gruvbox', accent: '#fabd2f', bg: '#1d2021', surface: '#282828' },
  { id: 'solarized', name: 'Solarized Dark', accent: '#2aa198', bg: '#00212b', surface: '#002b36' },
  { id: 'mono', name: 'Mono', accent: '#d4d4d4', bg: '#0a0a0a', surface: '#161616' },
  { id: 'amoled', name: 'AMOLED Black', accent: '#8aa4ff', bg: '#000000', surface: '#050505' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon (Drift Store)', accent: '#00f0ff', bg: '#080812', surface: '#111126' },
  { id: 'emerald', name: 'Emerald Matrix (Drift Store)', accent: '#00ff88', bg: '#05140b', surface: '#0b2415' },
  { id: 'synthwave', name: 'Synthwave 1984 (Drift Store)', accent: '#ff2a85', bg: '#140c24', surface: '#21153b' },
  { id: 'aurora', name: 'Aurora Borealis (Drift Store)', accent: '#4ef2bb', bg: '#07161b', surface: '#0e2329' },
  { id: 'obsidian', name: 'Solarized Obsidian (Drift Store)', accent: '#f59e0b', bg: '#0e0e11', surface: '#18181f' },
  { id: 'lavender', name: 'Lavender Dream (Drift Store)', accent: '#c084fc', bg: '#120f1c', surface: '#1c182c' },
];

export const colorTheme = (id: string) => COLOR_THEMES.find((t) => t.id === id);
