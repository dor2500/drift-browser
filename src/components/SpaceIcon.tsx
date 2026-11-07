import { Icon, type IconName } from './Icon';

const SPACE_ICONS = new Set(['home', 'work', 'game', 'book', 'palette', 'music', 'flask', 'plane', 'cart', 'chat', 'inbox', 'fox', 'globe', 'shield']);

/** A space's icon from Drift's icon set (falls back to text for anything older). */
export function SpaceIcon({ icon, size = 15 }: { icon: string; size?: number }) {
  return SPACE_ICONS.has(icon) ? <Icon name={icon as IconName} size={size} /> : <span>{icon}</span>;
}
