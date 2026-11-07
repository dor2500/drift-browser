const paths = {
  back: <path d="M15 18l-6-6 6-6" />,
  forward: <path d="M9 18l6-6-6-6" />,
  reload: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M7 7l10 10M17 7L7 17" />,
  speaker: (
    <>
      <path d="M11 5L6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  muted: (
    <>
      <path d="M11 5L6 9H3v6h3l5 4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  minimize: <path d="M6 12h12" />,
  maximize: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
  tab: <path d="M8 16L16 8M10 8h6v6" />,
  camera: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 11l5-3v8l-5-3" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  moreh: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth={3} />,
  next: <path d="M6 5.5v13l9-6.5zM18 5v14" fill="currentColor" />,
  prev: <path d="M18 5.5v13l-9-6.5zM6 5v14" fill="currentColor" />,
  star: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  pip: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
    </>
  ),
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  fox: (
    <>
      <path d="M4 4l4.5 4h7L20 4l-1 8.5c0 4.2-3.1 7.5-7 7.5s-7-3.3-7-7.5z" />
      <path d="M9.5 13.5h.01M14.5 13.5h.01M10.5 16.5l1.5 1 1.5-1" />
    </>
  ),
  home: <path d="M4 11l8-6.5 8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  work: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 13h17" />
    </>
  ),
  game: (
    <>
      <path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 4a2.3 2.3 0 0 1-4 1.1L14.8 16H9.2l-1.6 1.6a2.3 2.3 0 0 1-4-1.1l-.6-4A4 4 0 0 1 7 8z" />
      <path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" />
    </>
  ),
  book: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 0 4 21.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5z" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.6 0-1.2-1-1.5-1-2.6 0-.9.7-1.6 1.6-1.6h2.1a3.9 3.9 0 0 0 4-4c0-4.2-3.8-7.2-8.5-7.2z" />
      <path d="M7.5 12h.01M9.5 8h.01M14.5 8h.01" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V5.5l11-2v12" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="15.5" r="2.5" />
    </>
  ),
  flask: <path d="M9.5 3.5h5M10 3.5v6L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9.5v-6M7.5 15h9" />,
  plane: <path d="M21 15.5l-8-5V5a1.5 1.5 0 0 0-3 0v5.5l-8 5V17l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-4.5l8 2.5z" />,
  cart: (
    <>
      <path d="M3 4h2.2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.3" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  chat: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z" />,
  inbox: <path d="M4 13.5l2.4-8A1.5 1.5 0 0 1 7.8 4.5h8.4a1.5 1.5 0 0 1 1.4 1l2.4 8V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  broom: <path d="M19 3l-7.5 7.5M9.5 9.5l5 5M8 11l5 5-2 5c-3-1-6-3.5-8-7l5-3zM6.5 15.5L4 18" />,
  google: (
    <>
      <path d="M20.5 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z" />
      <path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.6-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z" />
      <path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8z" />
      <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
    </>
  ),
  import: <path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  shield:<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />,
  expand:<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />,
  split: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M12 4v16" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.9z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      <path d="M5 3l.7 1.6L7.3 5.3l-1.6.7L5 7.6l-.7-1.6L2.7 5.3l1.6-.7z" />
    </>
  ),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H15" />
    </>
  ),
  send: (
    <>
      <path d="M21 3L10 14" />
      <path d="M21 3l-6.5 18-4.5-7-7-4.5z" />
    </>
  ),
  devices: (
    <>
      <rect x="3" y="4.5" width="13" height="10" rx="1.5" />
      <path d="M6.5 17.5h6M9.5 14.5v3" />
      <rect x="14.5" y="9.5" width="6.5" height="10" rx="1.2" />
    </>
  ),
  pin: (
    <>
      <path d="M9 4h6l-1 5 3 3v1.5H7V12l3-3z" />
      <path d="M12 13.5V20" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6.5 6.5l.8 12.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  cloud: <path d="M6.5 19h11a4.2 4.2 0 0 0 .5-8.4A5.8 5.8 0 0 0 6.8 9a4.8 4.8 0 0 0-.3 10z" />,
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2v2h-2z" />
    </>
  ),
  puzzle: (
    <path d="M19 11h-1.5V7a2 2 0 0 0-2-2h-4a2.5 2.5 0 0 0-5 0H5a2 2 0 0 0-2 2v4a2.5 2.5 0 0 1 0 5v4a2 2 0 0 0 2 2h4a2.5 2.5 0 0 0 5 0h4a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z" />
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className={`ic ic-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
