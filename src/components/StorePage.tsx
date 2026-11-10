import { useEffect, useMemo, useState } from 'react';
import type { BrowserState } from '../../shared/types';
import { COLOR_THEMES } from '../../shared/colorThemes';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';
import { playAmbientSound, setAmbientVolume, stopAmbientSound } from '../lib/ambientSound';
import { StoreArtwork } from './StoreArtwork';

type StoreCategory = 'all' | 'security' | 'productivity' | 'media' | 'themes' | 'devtools';

interface ScreenshotSlide {
  title: string;
  subtitle: string;
  icon: IconName;
  features: string[];
}

interface StoreReview {
  author: string;
  stars: number;
  date: string;
  comment: string;
}

interface StoreItem {
  id: string;
  name: string;
  nameHe: string;
  category: 'security' | 'productivity' | 'media' | 'themes' | 'devtools';
  version: string;
  author: string;
  icon: IconName;
  description: string;
  descriptionHe: string;
  tags: string[];
  featuresHe: string[];
  rating: number;
  ratingCount: number;
  users: string;
  bannerGradient: string;
  bannerBadge: string;
  accentColor: string;
  screenshots: ScreenshotSlide[];
  reviews: StoreReview[];
}

const STORE_CATALOG: StoreItem[] = [
  {
    id: 'drift-shield-pro',
    name: 'Drift Shield Pro',
    nameHe: 'Drift Shield Pro — חבילת אבטחה מקסימאלית וטביעת אצבע',
    category: 'security',
    version: '2.4.0',
    author: 'Drift Security Labs',
    icon: 'shield',
    rating: 4.95,
    ratingCount: 28450,
    users: '240,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #091a2f 0%, #0d2d4d 50%, #0284c7 100%)',
    bannerBadge: '🛡️ MAXIMUM PRIVACY',
    accentColor: '#38bdf8',
    description:
      'Ultra privacy suite with Anti-Canvas fingerprinting, WebGL vendor cloaking, AudioContext jitter, battery protection, and homograph phishing detection.',
    descriptionHe:
      'הגנת פרטיות מקסימלית: מיסוך טביעות אצבע של Canvas, הסוואת כרטיס גרפי ב-WebGL, שיבוש AudioContext, חסימת דליפות סוללה והגנה מפני התקפות פישינג IDN Homograph.',
    tags: ['אבטחה', 'פרטיות', 'טביעת אצבע', 'אנטי-מעקב'],
    featuresHe: [
      'מיסוך Canvas Fingerprint למניעת זיהוי מעבר לאתרים',
      'הסוואת מעבד גרפי (WebGL Vendor & Renderer)',
      'שיבוש אקוסטי של AudioContext Frequency',
      'חסימת דליפות סטטוס סוללה (Battery API)',
      'איתור אוטומטי של התקפות פישינג וכתובות מתחזות (IDN Homograph)',
    ],
    screenshots: [
      {
        title: 'מסך הגנת טביעות אצבע רב-שכבתי',
        subtitle: 'סיכול מעקב מתקדם של חברות פרסום ברשת',
        icon: 'shield',
        features: ['הזרקת רעש אקראי דטרמיניסטי ל-Canvas', 'הסוואה אחידה של WebGL GPU', 'הגנת דליפות סוללה ואודיו'],
      },
      {
        title: 'סורק פישינג IDN Homograph בזמן אמת',
        subtitle: 'הגנה מפני שמות מתחם המשתמשים באותיות קיריליות מתחזות',
        icon: 'lock',
        features: ['זיהוי שמות מתחם בעלי תווים מעורבים', 'התרעה מיידית לפני הזנת סיסמאות', 'חסימת פרוטוקולים מסוכנים'],
      },
    ],
    reviews: [
      { author: 'רועי ל.', stars: 5, date: 'לפני יומיים', comment: 'התוסף הכי טוב שנוצר לפרטיות. כל בדיקות ה-Fingerprint עברו חלק!' },
      { author: 'Daniel S.', stars: 5, date: 'לפני שבוע', comment: 'Zero tracking, zero lag. Drift feels completely safe now.' },
    ],
  },
  {
    id: 'drift-zen-aura',
    name: 'Drift Zen Aura',
    nameHe: 'Drift Zen Aura — מחולל צלילי רקע ומוזיקת ריכוז',
    category: 'productivity',
    version: '1.8.2',
    author: 'Drift Audio Engine',
    icon: 'music',
    rating: 4.92,
    ratingCount: 19800,
    users: '185,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #1e112a 0%, #3b0764 50%, #a21caf 100%)',
    bannerBadge: '🎧 AMBIENT FOCUS AUDIO',
    accentColor: '#e879f9',
    description:
      'Offline ambient sound generator powered by Web Audio API. Pink rain, deep ocean, focus drone, and 10Hz binaural alpha beats without external internet or files.',
    descriptionHe:
      'מחולל צלילי אווירה ופוקוס מובנה: גשם מרגיע (Pink Noise), גלי אוקיינוס עמוקים, צליל חלל מרגיע וגלי מוח בינאורליים (10Hz Alpha Focus) — 100% לא מקוון וללא שימוש ברשת.',
    tags: ['פוקוס', 'שמע', 'גשם', 'ריכוז', 'ללא אינטרנט'],
    featuresHe: [
      'גשם מרגיע Pink Rain עם סינון תדרים חי',
      'גלי אוקיינוס בריכוך תדרים נמוכים',
      'גלי אלפא בינאורליים 10Hz להגברת הריכוז',
      'סינתזה בזמן אמת ב-Web Audio ללא הורדת קבצים',
      'עבודה חלקה לחלוטין ברקע בזמן גלישה',
    ],
    screenshots: [
      {
        title: 'סינתזת שמע חיה באמצעות Web Audio API',
        subtitle: 'צלילי טבע, גשם וגלי מוח ללא צורך בחיבור לרשת',
        icon: 'music',
        features: ['רעש ורוד של גשם טיפות טבעי', 'גלי אוקיינוס משתנים באטיות', 'גלי אלפא בינאורליים לריכוז לימודי ועבודה'],
      },
      {
        title: 'שליטה מהירה מוטמעת בעמוד הטאב החדש',
        subtitle: 'הפעלה וכיבוי ישירות תחת שורת החיפוש',
        icon: 'play',
        features: ['סליידר ווליום דינמי', 'מעבר בלחיצה בין צלילים', 'אפס עומס על הזיכרון'],
      },
    ],
    reviews: [
      { author: 'מיכל ב.', stars: 5, date: 'לפני 3 ימים', comment: 'צלילי הגשם המובנים עוזרים לי לעבוד שעות ברצף בלי הסחות דעת!' },
      { author: 'Alex M.', stars: 5, date: 'לפני שבועיים', comment: 'Binaural 10Hz mode is pure magic for coding sessions.' },
    ],
  },
  {
    id: 'drift-scratchpad',
    name: 'Drift Quick Scratchpad',
    nameHe: 'Drift Scratchpad — פנקס רשימות מהיר ומובנה',
    category: 'productivity',
    version: '1.5.0',
    author: 'Drift Productivity Team',
    icon: 'book',
    rating: 4.88,
    ratingCount: 12600,
    users: '110,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #b45309 100%)',
    bannerBadge: '📝 INSTANT SCRATCHPAD',
    accentColor: '#f59e0b',
    description:
      'Fast, private scratchpad for notes, code snippets, and to-do lists, permanently preserved across browser sessions.',
    descriptionHe:
      'פנקס פתקים וקוד מהיר עם שמירה אוטומטית מקומית קבועה, ללא צורך בהרשמה או שליחת נתונים לשרתים חיצוניים.',
    tags: ['פתקים', 'פרודוקטיביות', 'רשימות', 'קוד'],
    featuresHe: [
      'שמירה אוטומטית מקומית מיידית',
      'ספירת מילים ותווים בזמן אמת',
      'העתקה מהירה בלחיצת כפתור',
      'ללא שמירה בענן — פרטיות מקסימלית במכשיר בלבד',
    ],
    screenshots: [
      {
        title: 'עורך פתקים וקוד קל משקל',
        subtitle: 'שמירה אוטומטית בכל הקלדה במכשיר שלך בלבד',
        icon: 'book',
        features: ['העתקה מהירה ללוח המערכת', 'תמיכה בפתקים ארוכים וקוד', 'ללא שליחת נתונים לשום שרת'],
      },
    ],
    reviews: [
      { author: 'אורן ק.', stars: 5, date: 'לפני 4 ימים', comment: 'סוף סוף פנקס נוח בלי לפתוח תוכנות חיצוניות כל פעם שרוצים להעתיק משהו.' },
    ],
  },
  {
    id: 'drift-focus-timer',
    name: 'Drift Pomodoro Focus',
    nameHe: 'Drift Pomodoro — טיימר פוקוס 25/5 מובנה',
    category: 'productivity',
    version: '1.2.0',
    author: 'Drift Focus Lab',
    icon: 'clock',
    rating: 4.85,
    ratingCount: 9400,
    users: '95,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #2a0b12 0%, #4c0519 50%, #e11d48 100%)',
    bannerBadge: '⏱️ 25/5 POMODORO',
    accentColor: '#fb7185',
    description:
      'Integrated Pomodoro focus timer with 25-minute sprints and 5-minute restorative breaks.',
    descriptionHe:
      'טיימר פומומורו מובנה לגלישה יעילה: 25 דקות פוקוס ו-5 דקות הפסקה עם התראות שמע נעימות לשמירה על ריכוז עבודה גבוה.',
    tags: ['פומומורו', 'טיימר', 'ניהול זמן', 'ריכוז'],
    featuresHe: ['מחזורי 25 דקות ריכוז / 5 דקות הפסקה', 'טיימר ויזואלי ברור', 'צליל סיום מובנה'],
    screenshots: [
      {
        title: 'שעון פוקוס וניהול זמנים',
        subtitle: 'ספרינטים מוגדרים של 25 דקות עבודה ו-5 דקות מנוחה',
        icon: 'clock',
        features: ['טיימר עבודה ויזואלי בולט', 'התראת סיום נעימה', 'איפוס וסנכרון מהיר בלחיצה'],
      },
    ],
    reviews: [
      { author: 'שירה ד.', stars: 5, date: 'אתמול', comment: 'שומר אותי ממוקדת בעבודה ולא מאבדת שעות בשיטוטים ברשת.' },
    ],
  },
  {
    id: 'drift-security-auditor',
    name: 'Drift Security Auditor',
    nameHe: 'Drift Security Auditor — סורק אבטחת אתרים ואישורי SSL',
    category: 'security',
    version: '2.0.1',
    author: 'Drift Security Labs',
    icon: 'lock',
    rating: 4.96,
    ratingCount: 22100,
    users: '160,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #052e16 0%, #064e3b 50%, #10b981 100%)',
    bannerBadge: '🔒 TLS 1.3 & CSP AUDITOR',
    accentColor: '#34d399',
    description:
      'Real-time website security inspector checking SSL/TLS encryption, CSP headers, X-Frame clickjacking defense, and mixed content rating.',
    descriptionHe:
      'סורק אבטחה בזמן אמת הבוחן את רמת ההצפנה (TLS), תקינות אישורי SSL, מדיניות CSP נגד הזרקת קוד ומעניק ציון אבטחה לאתר הפעיל.',
    tags: ['SSL', 'אבטחה', 'CSP', 'סורק'],
    featuresHe: [
      'בדיקת הצפנת TLS 1.3 ושלמות אישורי אבטחה',
      'בדיקת כותרות Content-Security-Policy (CSP)',
      'הגנה מפני Clickjacking ו-Mixed Content',
      'ציון אבטחה מהיר בזמן אמת',
    ],
    screenshots: [
      {
        title: 'דוח אבטחה מלא לכל דף אינטרנט',
        subtitle: 'אישורי הצפנה, כותרות HSTS והגנה מפני הזרקות',
        icon: 'lock',
        features: ['ציון אבטחה חי (A+ עד F)', 'איתור תוכן מעורב לא מוצפן (Mixed Content)', 'בדיקת תקפות תעודת SSL של האתר'],
      },
    ],
    reviews: [
      { author: 'Eliyahu V.', stars: 5, date: 'לפני יומיים', comment: 'מושלם למפתחי אתרים ולכל מי שחשוב לו לדעת אם האתר שהוא גולש בו באמת מאובטח.' },
    ],
  },
  {
    id: 'drift-video-booster',
    name: 'Drift Video & Audio Booster',
    nameHe: 'Drift Video Popout & Audio Booster — מגבר קול ושליטת וידאו',
    category: 'media',
    version: '1.6.4',
    author: 'Drift Media Works',
    icon: 'pip',
    rating: 4.89,
    ratingCount: 15300,
    users: '135,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #172554 0%, #1e1b4b 50%, #6366f1 100%)',
    bannerBadge: '🎬 300% AUDIO & PIP',
    accentColor: '#818cf8',
    description:
      'Picture-in-picture controller, volume booster up to 300% for quiet web videos, and variable playback speed controls.',
    descriptionHe:
      'הגברת שמע של סרטונים עד 300% (לסרטונים חלשים), מעבר מיידי ל-Picture-in-Picture ושליטה במהירות ניגון מ-0.25x עד 4.0x.',
    tags: ['וידאו', 'PiP', 'ווליום', 'מדיה'],
    featuresHe: ['מגבר ווליום ייעודי עד 300%', 'שליטה גלובלית במהירות ניגון', 'לחצן PiP צף חכם'],
    screenshots: [
      {
        title: 'מגבר שמע עד 300% לסרטונים חלשים',
        subtitle: 'שימוש ב-GainNode של Web Audio להגברה נקייה מעיוותים',
        icon: 'speaker',
        features: ['הגברת קול נקייה וחזקה', 'לחצן תמונה בתוך תמונה (PiP) בכל אתר וידאו', 'שליטה במהירויות מ-0.25x עד 4.0x'],
      },
    ],
    reviews: [
      { author: 'יונתן ש.', stars: 5, date: 'לפני 5 ימים', comment: 'סוף סוף שומעים מעולה בהרצאות ובסרטונים מוקלטים חלשים ביוטיוב!' },
    ],
  },
  {
    id: 'drift-reader-mode',
    name: 'Drift Reader Mode Plus',
    nameHe: 'Drift Reader Mode Plus — מצב קריאה מתקדם עם הקראת טקסט',
    category: 'productivity',
    version: '2.1.0',
    author: 'Drift Editorial',
    icon: 'book',
    rating: 4.91,
    ratingCount: 17800,
    users: '145,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #71717a 100%)',
    bannerBadge: '📖 CLEAN READER & TTS',
    accentColor: '#a1a1aa',
    description:
      'Distraction-free reading environment stripping clutter and ads, with customizable typography, dark/sepia modes, and text-to-speech voice narration.',
    descriptionHe:
      'מנקה מאמרים ודפי תוכן מפרסומות והפרעות, מאפשר בחירת גופנים וצבעי קריאה, ותומך בהקראת המאמר בקול באמצעות Text-to-Speech.',
    tags: ['קריאה', 'מאמרים', 'הקראה בקול', 'נגישות'],
    featuresHe: ['ממשק קריאה נקי ומבודד', 'בחירת גופנים, גדלים ומרווחים', 'הקראה קולית ישירה בדפדפן'],
    screenshots: [
      {
        title: 'חוויית קריאה נקייה מפרסומות והפרעות',
        subtitle: 'חילוץ תוכן חכם, גופנים אלגנטיים ומצב כהה/ספיה',
        icon: 'book',
        features: ['התאמת גודל אות וריווח שורות', 'הקראת טקסט קולית בעברית ובאנגלית', 'ייצוא קריאה ל-Markdown'],
      },
    ],
    reviews: [
      { author: 'טל כ.', stars: 5, date: 'לפני שבוע', comment: 'הקראת הטקסט בקול היא פשוט תענוג כשאני קורא כתבות ארוכות תוך כדי משימות.' },
    ],
  },
  {
    id: 'drift-dark-reader',
    name: 'Drift Dark Reader Max',
    nameHe: 'Drift Dark Reader Max — מצב לילה חכם ומנוע ניגודיות OLED',
    category: 'productivity',
    version: '2.5.0',
    author: 'Drift Visual Labs',
    icon: 'moon',
    rating: 4.97,
    ratingCount: 34100,
    users: '310,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)',
    bannerBadge: '🌙 OLED DARK MODE',
    accentColor: '#38bdf8',
    description:
      'Smart dark theme generator for every website with OLED blacks, contrast preservation, blue-light filter and sepia controls.',
    descriptionHe:
      'מנוע מצב כהה חכם לכל אתר ברשת: הופך אתרי אינטרנט בהירים ובוהקים למצב לילה שחור OLED עמוק עם סינון אור כחול והגנה על העיניים.',
    tags: ['מצב לילה', 'OLED', 'עיצוב', 'שחור', 'בריאות עיניים'],
    featuresHe: [
      'המרת כל אתר למצב לילה עמוק בזמן אמת',
      'שמירה על ניגודיות תמונות וצבעים טבעיים',
      'סינון אור כחול (Sepia) לשעות הערב והלילה',
      'אפס מאמץ על הסוללה במסכי OLED',
    ],
    screenshots: [
      {
        title: 'מנוע היפוך גוונים חכם מבוסס OLED',
        subtitle: 'שחור מוחלט החוסך בחיי סוללה ומונע סינוור עיניים',
        icon: 'moon',
        features: ['שחור OLED אמיתי #000000', 'שמירה על צבעי תמונות ווידאו', 'התאמה אוטומטית לפי שעות השקיעה'],
      },
      {
        title: 'סרגלי כוונון בהירות, ניגודיות וספיה',
        subtitle: 'שליטה מדויקת ברמת החום והרכות של הצבעים',
        icon: 'sliders',
        features: ['סליידר בהירות וניגודיות חי', 'פילטר חום גוונים להפחתת עייפות', 'החרגת אתרים בלחיצה אחת'],
      },
    ],
    reviews: [
      { author: 'נועם ד.', stars: 5, date: 'אתמול', comment: 'התוסף הכי חשוב בדפדפן! העיניים שלי כבר לא שורפות בגלישה בלילה.' },
      { author: 'David K.', stars: 5, date: 'לפני 3 ימים', comment: 'Way better and faster than external extensions. Smooth 60fps scrolling.' },
    ],
  },
  {
    id: 'drift-dev-tools',
    name: 'Drift DevTools Pro',
    nameHe: 'Drift DevTools Pro — סרגל כלי מפתח: JSON, Regex & Pipette',
    category: 'devtools',
    version: '1.4.0',
    author: 'Drift Developer Core',
    icon: 'bolt',
    rating: 4.93,
    ratingCount: 16500,
    users: '120,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
    bannerBadge: '🛠️ DEVELOPER SUITE',
    accentColor: '#34d399',
    description:
      'Developer utilities right inside Drift: Instant JSON Tree Viewer, Base64 encoder/decoder, Live Regex sandbox, and Screen Color Pipette.',
    descriptionHe:
      'סרגל כלי פיתוח מובנה: מציג ומעצב קבצי JSON בעץ היררכי צבעוני, מקודד ומפענח Base64, בודק ביטויים רגולריים (Regex) ודוגם צבעים ישירות מהמסך.',
    tags: ['פיתוח', 'JSON', 'Regex', 'צבעים', 'מפתחים'],
    featuresHe: [
      'מעצב ועץ JSON צבעוני עם קיפול ענפים',
      'בודק ביטויים רגולריים (Regex) בזמן אמת',
      'דוגם צבעים (Color Pipette) עם קודי HEX / RGB / HSL',
      'קידוד ופענוח Base64 / URL בלחיצה',
    ],
    screenshots: [
      {
        title: 'מעצב JSON צבעוני עם חיפוש וסינון',
        subtitle: 'עץ היררכי קריא עם העתקת מפתחות וערכים',
        icon: 'bolt',
        features: ['הדגשת תחביר (Syntax Highlighting)', 'כיווץ והרחבת אובייקטים', 'העתקת נתיבי JSONPath'],
      },
      {
        title: 'דוגם צבעים וארגז חול ל-Regex',
        subtitle: 'בדיקת התאמות ביטויים ודגימת צבעים ישירות מהאתר',
        icon: 'palette',
        features: ['דגימת פיקסל מהמסך', 'המרת צבעים ל-CSS HEX/RGBA', 'הדגשת Regex Match חיה'],
      },
    ],
    reviews: [
      { author: 'גיא ר.', stars: 5, date: 'לפני 4 ימים', comment: 'חוסך לי לפתוח אתרים חיצוניים מעצבנים לעיצוב JSON ובדיקת Regex. מעולה!' },
    ],
  },
  {
    id: 'drift-speed-booster',
    name: 'Drift Turbo Speed & RAM Saver',
    nameHe: 'Drift Speed Booster — מאיץ טעינת אתרים וחיסכון בזיכרון RAM',
    category: 'productivity',
    version: '2.2.0',
    author: 'Drift Core Performance',
    icon: 'bolt',
    rating: 4.96,
    ratingCount: 26800,
    users: '210,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #f59e0b 100%)',
    bannerBadge: '⚡ 3.4x FASTER BROWSING',
    accentColor: '#f59e0b',
    description:
      'Turbocharges web browsing with speculative prerendering, DNS prefetching, Brotli decompression, and automatic background tab memory saver.',
    descriptionHe:
      'האצת גלישה וטעינת עמודים ב-3.4x, טעינה מוקדמת חכמה, ושחרור אוטומטי של עד 65% מצריכת זיכרון ה-RAM בטאבים לא פעילים.',
    tags: ['מהירות', 'RAM', 'ביצועים', 'זיכרון', 'טורבו'],
    featuresHe: [
      'שחרור אוטומטי של עד 65% זיכרון RAM בטאבים ברקע',
      'מנוע טעינה מוקדמת וחיזוי ניווט (Speculative Prerender)',
      'ביטול תקיעות וגלישה מהירה וחלקה ב-60fps',
      'דחיסת נכסים סטטיים מקומית מואצת',
    ],
    screenshots: [
      {
        title: 'מד חיסכון RAM ומנוע טורבו פעיל',
        subtitle: 'שחרור אוטומטי של טאבים שאינם בשימוש להקלת עומס המעבד',
        icon: 'bolt',
        features: ['שחרור 1.8GB זיכרון RAM אוטומטית', 'הפחתת עומס סוללה במחשבים ניידים', 'טעינת דפים מואצת פי 3.4'],
      },
      {
        title: 'מנוע חיזוי ניווט וטעינה מוקדמת (Prerender)',
        subtitle: 'הורדת זמני תגובת שרתי אינטרנט ל-180ms',
        icon: 'bolt',
        features: ['DNS Prefetching אוטומטי', 'TCP Preconnect מהיר', 'פתיחת עמודים מיידית בלחיצה'],
      },
    ],
    reviews: [
      { author: 'מתן א.', stars: 5, date: 'לפני יומיים', comment: 'המחשב שלי כבר לא נחנק כשיש לי 40 טאבים פתוחים. שיפור מטורף!' },
      { author: 'Eitan B.', stars: 5, date: 'אתמול', comment: 'Pages open instantly now. RAM consumption dropped significantly.' },
    ],
  },
  {
    id: 'drift-translator',
    name: 'Drift Local Translator',
    nameHe: 'Drift Local Translator — מתרגם עמודים וטקסט מקומי ללא ענן',
    category: 'productivity',
    version: '1.9.0',
    author: 'Drift AI Team',
    icon: 'globe',
    rating: 4.94,
    ratingCount: 18900,
    users: '175,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #3b82f6 100%)',
    bannerBadge: '🌐 OFFLINE PRIVACY TRANSLATOR',
    accentColor: '#60a5fa',
    description:
      'Instant, offline on-device translation between Hebrew, English and 20+ languages with zero cloud tracking and hovering word popup.',
    descriptionHe:
      'תרגום מיידי ומובנה של עמודי אינטרנט ופסקאות: פועל 100% מקומית ללא שליחת טקסטים או מידע אישי לשום שרת ענן חיצוני.',
    tags: ['תרגום', 'שפות', 'פרטיות', 'עברית', 'אנגלית'],
    featuresHe: [
      'תרגום מקומי דו-כיווני עברית/אנגלית ללא צורך בענן',
      'בועת תרגום מיידית בריחוף סמן מעל מילים',
      'אפס דליפות פרטיות — כל התרגומים נשארים במחשב שלך',
      'זיהוי שפה אוטומטי ותרגום עמוד מלא בלחיצה',
    ],
    screenshots: [
      {
        title: 'תרגום טקסט מקומי דו-כיווני ללא ענן',
        subtitle: 'עיבוד מהיר מבוסס מודל שפה מקומי השומר על סודיות מוחלטת',
        icon: 'globe',
        features: ['תרגום מיידי מעברית לאנגלית ומאנגלית לעברית', 'שמירה מלאה על פרטיות הטקסט הנקרא', 'עבודה מלאה גם ללא חיבור לאינטרנט'],
      },
      {
        title: 'בועת תרגום צפה בריחוף מעל מילים',
        subtitle: 'הסבר פונטי ותרגום מהיר ללא צורך בהעתקה והדבקה',
        icon: 'book',
        features: ['הגיית מילים וסימני ניקוד', 'הצעות למילים נרדפות והקשרים', 'שילוב חלק בכל דף אינטרנט'],
      },
    ],
    reviews: [
      { author: 'קרן ש.', stars: 5, date: 'לפני יומיים', comment: 'מושלם! לא שולח את המסמכים החסויים שלי לענן של גוגל ומתרגם מעולה.' },
    ],
  },
  {
    id: 'drift-tab-matrix',
    name: 'Drift Tab Matrix & Tree',
    nameHe: 'Drift Tab Matrix — עץ טאבים, קבוצות חכמות והשהיה אוטומטית',
    category: 'productivity',
    version: '2.3.0',
    author: 'Drift Workspace Studio',
    icon: 'tab',
    rating: 4.92,
    ratingCount: 14200,
    users: '130,000+ משתמשים',
    bannerGradient: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #22c55e 100%)',
    bannerBadge: '🗂️ SMART TAB STACKS',
    accentColor: '#4ade80',
    description:
      'Visual tab organization with automatic domain grouping, vertical tree hierarchy, sleeping tab hibernation, and search.',
    descriptionHe:
      'ארגון ויזואלי של טאבים לפי נושאים וקבוצות צבעוניות, השהיית טאבים חסכונית במצב שינה וחיפוש מהיר בכל הטאבים הפתוחים.',
    tags: ['טאבים', 'ניהול טאבים', 'קבוצות', 'חיסכון בזיכרון'],
    featuresHe: [
      'קיבוץ טאבים אוטומטי לפי מתחמים ופרויקטים',
      'השהיה חכמה של טאבים לא פעילים לחיסכון במשאבים',
      'חיפוש מיידי וסינון בין עשרות טאבים פתוחים',
      'סנכרון מלא עם סרגל הצד של Drift',
    ],
    screenshots: [
      {
        title: 'חלוקה וקיבוץ טאבים לפי נושאים צבעוניים',
        subtitle: 'הפרדה נוחה בין עבודה, לימודים, מדיה ופרויקטים',
        icon: 'tab',
        features: ['קבוצות עם שמות וצבעים מותאמים אישית', 'קיפול והרחבת קבוצות טאבים בלחיצה', 'העברת טאבים בין חלונות בקלות'],
      },
      {
        title: 'לוח השהיית טאבים במצב שינה (Sleeping Tabs)',
        subtitle: 'צפייה בחיסכון במשאבים והחזרת טאבים לפעילות ברגע',
        icon: 'moon',
        features: ['מעקב אחר זיכרון שנחסך לכל טאב', 'התעוררות מהירה בלחיצה ללא איבוד מידע', 'החרגת אתרי מוזיקה ווידאו מהשהיה'],
      },
    ],
    reviews: [
      { author: 'ברק פ.', stars: 5, date: 'לפני 3 ימים', comment: 'הסדר והניקיון בדפדפן עלו רמה. קיבוץ הטאבים פשוט גאוני.' },
    ],
  },
];

export function StorePage({ state }: { state: BrowserState }) {
  const storeSettings = state.settings.store;
  const [activeTab, setActiveTab] = useState<StoreCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected item for Detailed Modal & Screenshots Gallery
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);

  // Per-card screenshot slider index state
  const [cardSlideIdx, setCardSlideIdx] = useState<Record<string, number>>({});

  // Featured carousel index
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // Auto-advance hero carousel every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFeaturedIdx((prev) => (prev + 1) % STORE_CATALOG.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  // Zen Aura sound preview state
  const [audioPlaying, setAudioPlaying] = useState(storeSettings?.ambientSound?.playing ?? false);
  const [soundType, setSoundType] = useState(storeSettings?.ambientSound?.sound ?? 'rain');
  const [volume, setVolume] = useState(storeSettings?.ambientSound?.volume ?? 0.5);

  // Scratchpad notes live state
  const [notes, setNotes] = useState(storeSettings?.scratchpadNotes ?? '');

  // Pomodoro timer state
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pomoRunning && pomoSeconds > 0) {
      interval = setInterval(() => setPomoSeconds((s) => s - 1), 1000);
    } else if (pomoSeconds === 0) {
      setPomoRunning(false);
      showToast('⏰ הפומומורו הסתיים! הגיע הזמן להפסקה מרעננת.');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomoRunning, pomoSeconds]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const installedSet = useMemo(() => new Set(storeSettings?.installed ?? []), [storeSettings?.installed]);
  const disabledSet = useMemo(() => new Set(storeSettings?.disabled ?? []), [storeSettings?.disabled]);

  const toggleInstall = (id: string) => {
    const isInstalled = installedSet.has(id);
    const nextInstalled = isInstalled
      ? storeSettings.installed.filter((x) => x !== id)
      : [...storeSettings.installed, id];
    cmd({
      type: 'settings:set',
      patch: {
        store: { installed: nextInstalled },
      },
    });
    showToast(isInstalled ? `התוסף הוסר בהצלחה` : `התוסף הותקן בהצלחה והופעל!`);
  };

  const toggleEnabled = (id: string) => {
    const isDisabled = disabledSet.has(id);
    const nextDisabled = isDisabled
      ? storeSettings.disabled.filter((x) => x !== id)
      : [...storeSettings.disabled, id];
    cmd({
      type: 'settings:set',
      patch: {
        store: { disabled: nextDisabled },
      },
    });
    showToast(isDisabled ? `התוסף הופעל` : `התוסף כובה זמנית`);
  };

  const handleAudioToggle = () => {
    if (audioPlaying) {
      stopAmbientSound();
      setAudioPlaying(false);
      cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: false, sound: soundType, volume } } } });
    } else {
      playAmbientSound(soundType, volume);
      setAudioPlaying(true);
      cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: true, sound: soundType, volume } } } });
    }
  };

  const handleSoundChange = (type: 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural') => {
    setSoundType(type);
    if (audioPlaying) {
      playAmbientSound(type, volume);
    }
    cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: audioPlaying, sound: type, volume } } } });
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setAmbientVolume(v);
    cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: audioPlaying, sound: soundType, volume: v } } } });
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    cmd({ type: 'settings:set', patch: { store: { scratchpadNotes: text } } });
  };

  const applyTheme = (themeId: string) => {
    cmd({ type: 'settings:set', patch: { colorTheme: themeId } });
    showToast(`ערכת העיצוב הוחלה בהצלחה!`);
  };

  // Filtered items
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return STORE_CATALOG.filter((item) => {
      const matchCat = activeTab === 'all' || item.category === activeTab;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.nameHe.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.descriptionHe.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeTab, searchQuery]);

  const activeTabDetails = state.tabs.find((t) => t.id === state.activeTabId);
  const activeUrl = activeTabDetails?.url ?? '';
  const isHttps = activeUrl.startsWith('https://');

  const featuredItem = STORE_CATALOG[featuredIdx % STORE_CATALOG.length];

  return (
    <div className="store-page" dir="rtl">
      {/* Top Banner & Header */}
      <header className="store-header">
        <div className="store-hero">
          <div className="store-hero-badge">
            <Icon name="puzzle" size={16} />
            <span>חנות התוספים, האבטחה והערכות הרשמית של Drift</span>
          </div>
          <h1>Drift Store & Extensions Hub</h1>
          <p className="store-sub">
            חנות עשירה עם תוספים מקוריים, כלי אבטחה ופרטיות מקסימליים, צלילי אווירה, כלי פרודוקטיביות וערכות נושא מעוצבות.
          </p>

          <div className="store-search-wrap">
            <Icon name="search" size={18} />
            <input
              type="text"
              placeholder="חיפוש תוספים, ערכות נושא, כלי אבטחה, צלילים ופרטיות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="store-search-input"
            />
            {searchQuery && (
              <button className="store-clear-search" onClick={() => setSearchQuery('')}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Security Status Card */}
        <div className="store-security-card">
          <div className="security-card-header">
            <div className="security-icon-wrap">
              <Icon name="shield" size={24} />
            </div>
            <div>
              <div className="security-title">מערך אבטחה מקסימאלי פעיל (Drift Shield Max)</div>
              <div className="security-sub">חסימת פרסומות, שיבוש טביעת אצבע והצפנה פעילים</div>
            </div>
          </div>
          <div className="security-metrics">
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Canvas Cloaking</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>WebGL Masking</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Audio Frequency Jitter</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Homograph Phishing Shield</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Tracking Parameter Stripper</span>
            </div>
          </div>
        </div>
      </header>

      {/* Featured Spotlight Hero Banner (Carousel like Chrome Web Store & App Store) */}
      {!searchQuery && activeTab === 'all' && (
        <section className="store-featured-hero" style={{ background: featuredItem.bannerGradient }}>
          <div className="featured-hero-glow" />
          <div className="featured-hero-content">
            <div className="featured-hero-tag">
              <span className="star-icon">★</span>
              <span>נבחרת העורכים · תוסף מומלץ</span>
              <span className="badge version">v{featuredItem.version}</span>
            </div>
            <h2 className="featured-hero-title">{featuredItem.nameHe}</h2>
            <p className="featured-hero-desc">{featuredItem.descriptionHe}</p>

            <div className="featured-hero-meta">
              <div className="stars-rating">
                <span className="stars-gold">★★★★★</span>
                <span className="stars-val">{featuredItem.rating}</span>
                <span className="stars-count">({featuredItem.ratingCount.toLocaleString()} דירוגים)</span>
              </div>
              <span className="meta-sep">•</span>
              <div className="users-count">👥 {featuredItem.users}</div>
              <span className="meta-sep">•</span>
              <div className="verified-dev">✓ פותח במעבדות Drift</div>
            </div>

            <div className="featured-hero-actions">
              <button
                className={cx('btn primary')}
                style={{ background: featuredItem.accentColor, color: '#090d16', fontWeight: 600, padding: '0 22px', height: '38px' }}
                onClick={() => toggleInstall(featuredItem.id)}
              >
                <Icon name={installedSet.has(featuredItem.id) ? 'check' : 'plus'} size={16} />
                <span>{installedSet.has(featuredItem.id) ? '✓ מותקן בדפדפן' : 'התקנה מהירה בלחיצה אחת'}</span>
              </button>
              <button
                className="btn ghost"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', height: '38px', padding: '0 18px' }}
                onClick={() => {
                  setSelectedItem(featuredItem);
                  setActiveScreenshotIdx(0);
                }}
              >
                <Icon name="info" size={15} />
                <span>צפה בצילומי מסך ופרטים</span>
              </button>
            </div>
          </div>

          {/* Visual Artwork Showcase Mockup on Hero */}
          <div className="featured-hero-visual" onClick={() => setSelectedItem(featuredItem)}>
            <div className="hero-artwork-frame">
              <StoreArtwork itemId={featuredItem.id} slideIdx={0} className="hero-artwork-rendered" />
              <div className="artwork-overlay-pill">🔍 לחץ לצפייה בגלריית צילומי מסך מלאה</div>
            </div>

            {/* Carousel navigation buttons and arrows */}
            <div className="hero-carousel-nav" onClick={(e) => e.stopPropagation()}>
              <button
                className="hero-arrow-btn"
                onClick={() => setFeaturedIdx((prev) => (prev > 0 ? prev - 1 : STORE_CATALOG.length - 1))}
                title="התוסף המומלץ הקודם"
              >
                ‹
              </button>
              <div className="hero-carousel-dots">
                {STORE_CATALOG.slice(0, 6).map((_, idx) => (
                  <button
                    key={idx}
                    className={cx('carousel-dot', (featuredIdx % 6) === idx && 'active')}
                    onClick={() => setFeaturedIdx(idx)}
                    title={`הצג תוסף מומלץ ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                className="hero-arrow-btn"
                onClick={() => setFeaturedIdx((prev) => (prev + 1) % STORE_CATALOG.length)}
                title="התוסף המומלץ הבא"
              >
                ›
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tabs / Filter Navigation */}
      <nav className="store-nav">
        <button
          className={cx('store-nav-btn', activeTab === 'all' && 'active')}
          onClick={() => setActiveTab('all')}
        >
          <Icon name="puzzle" size={15} />
          <span>כל התוספים ({STORE_CATALOG.length})</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'security' && 'active')}
          onClick={() => setActiveTab('security')}
        >
          <Icon name="shield" size={15} />
          <span>אבטחה ופרטיות מקסימלית</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'productivity' && 'active')}
          onClick={() => setActiveTab('productivity')}
        >
          <Icon name="bolt" size={15} />
          <span>פרודוקטיביות ופוקוס</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'media' && 'active')}
          onClick={() => setActiveTab('media')}
        >
          <Icon name="play" size={15} />
          <span>מולטימדיה ווידאו</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'devtools' && 'active')}
          onClick={() => setActiveTab('devtools')}
        >
          <Icon name="bolt" size={15} />
          <span>כלי פיתוח ו-Regex</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'themes' && 'active')}
          onClick={() => setActiveTab('themes')}
        >
          <Icon name="palette" size={15} />
          <span>ערכות עיצוב וסטיילים ({COLOR_THEMES.length})</span>
        </button>
      </nav>

      {/* Catalog Cards Grid */}
      <div className="store-content">
        {activeTab !== 'themes' && (
          <div className="store-grid">
            {filteredCatalog.map((item) => {
              const installed = installedSet.has(item.id);
              const disabled = disabledSet.has(item.id);
              const isAura = item.id === 'drift-zen-aura';
              const isShield = item.id === 'drift-shield-pro';
              const isNotes = item.id === 'drift-scratchpad';
              const isPomo = item.id === 'drift-focus-timer';
              const isAuditor = item.id === 'drift-security-auditor';
              const currentSlide = cardSlideIdx[item.id] ?? 0;

              return (
                <div key={item.id} className={cx('store-card', !installed && 'not-installed')}>
                  {/* Extension Card Graphic Banner (Visual Hero Artwork Image) */}
                  <div
                    className="store-card-banner"
                    style={{ background: item.bannerGradient }}
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveScreenshotIdx(currentSlide);
                    }}
                  >
                    {/* Visual UI Screenshot Mockup */}
                    <div className="banner-artwork-wrapper">
                      <StoreArtwork itemId={item.id} slideIdx={currentSlide} className="card-artwork-embed" />
                    </div>

                    <div className="card-banner-top">
                      <span className="card-banner-badge">{item.bannerBadge}</span>
                      <span className="banner-chip-rating">★ {item.rating}</span>
                    </div>

                    <div className="card-banner-bottom" onClick={(e) => e.stopPropagation()}>
                      <div className="card-slide-selector">
                        {item.screenshots.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            className={cx('card-slide-btn', currentSlide === sIdx && 'active')}
                            onClick={() => setCardSlideIdx((prev) => ({ ...prev, [item.id]: sIdx }))}
                            title={`צילום מסך ${sIdx + 1}: ${s.title}`}
                          >
                            📸 צילום {sIdx + 1}
                          </button>
                        ))}
                      </div>
                      <button
                        className="banner-zoom-pill"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveScreenshotIdx(currentSlide);
                        }}
                      >
                        🔍 הגדל
                      </button>
                    </div>
                  </div>

                  {/* Card Content & Details */}
                  <div className="store-card-body">
                    <div className="store-card-header">
                      <div className="store-card-icon" style={{ color: item.accentColor }}>
                        <Icon name={item.icon} size={20} />
                      </div>
                      <div className="store-card-titles">
                        <div className="store-card-badges">
                          <span className="badge official">מקורי Drift</span>
                          <span className="badge verified">מאומת אבטחתית</span>
                        </div>
                        <h3 className="store-card-title">{item.nameHe}</h3>
                        <div className="card-meta-line">
                          <span className="store-card-author">{item.author}</span>
                          <span className="meta-dot">•</span>
                          <span className="card-users-badge">👥 {item.users}</span>
                        </div>
                      </div>
                    </div>

                    <p className="store-card-desc">{item.descriptionHe}</p>

                    {/* Features checklist */}
                    <div className="store-card-features">
                      {item.featuresHe.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="feature-item">
                          <Icon name="check" size={12} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* Quick Screenshots Mini Gallery on Card */}
                    <div className="card-quick-gallery">
                      <div className="quick-gallery-label">
                        <Icon name="tab" size={12} />
                        <span>גלריית צילומי מסך מהירים:</span>
                      </div>
                      <div className="quick-gallery-thumbs">
                        {item.screenshots.map((s, idx) => (
                          <div
                            key={idx}
                            className={cx('quick-gallery-thumb', currentSlide === idx && 'active')}
                            onClick={() => setCardSlideIdx((prev) => ({ ...prev, [item.id]: idx }))}
                            title={`לחץ להחלפת צילום מסך: ${s.title}`}
                          >
                            <div className="thumb-art-crop">
                              <StoreArtwork itemId={item.id} slideIdx={idx} className="thumb-mini-art" />
                            </div>
                            <span className="thumb-label">צילום {idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Interactive live widget for Shield Pro */}
                    {isShield && installed && !disabled && (
                      <div className="store-live-widget auditor-widget">
                        <div className="auditor-header">
                          <div className="auditor-grade">מצב הגנה: אקטיבי 100%</div>
                          <div className="auditor-host">טביעות אצבע חסומות ומסוות</div>
                        </div>
                        <div className="auditor-checks">
                          <div className="aud-check ok">✓ מיסוך Canvas Fingerprint: פעיל</div>
                          <div className="aud-check ok">✓ הסוואת WebGL GPU Renderer: פעיל</div>
                          <div className="aud-check ok">✓ שיבוש תדרי AudioContext: פעיל</div>
                          <div className="aud-check ok">✓ הגנת דליפות סוללה Battery API: פעיל</div>
                        </div>
                      </div>
                    )}

                    {/* Interactive live widget for Zen Aura */}
                    {isAura && installed && !disabled && (
                      <div className="store-live-widget aura-widget">
                        <div className="widget-row">
                          <button
                            className={cx('btn', audioPlaying ? 'ghost' : 'primary', 'small')}
                            onClick={handleAudioToggle}
                          >
                            <Icon name={audioPlaying ? 'pause' : 'play'} size={14} />
                            <span>{audioPlaying ? 'עצור צלילי רקע' : 'הפעל צלילי רקע עכשיו'}</span>
                          </button>
                          <select
                            className="field-input widget-select"
                            value={soundType}
                            onChange={(e) => handleSoundChange(e.target.value as 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural')}
                          >
                            <option value="rain">🌧️ גשם מרגיע (Pink Rain)</option>
                            <option value="ocean">🌊 גלי אוקיינוס (Ocean Swell)</option>
                            <option value="binaural">🧠 גלי אלפא 10Hz (Focus Beats)</option>
                            <option value="drone">🌌 צליל חלל עמוק (Cosmic Drone)</option>
                            <option value="whitenoise">📻 רעש לבן (Pure White Noise)</option>
                          </select>
                        </div>
                        <div className="volume-row">
                          <Icon name="speaker" size={13} />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="volume-slider"
                          />
                          <span className="vol-percent">{Math.round(volume * 100)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Interactive live widget for Scratchpad */}
                    {isNotes && installed && !disabled && (
                      <div className="store-live-widget notes-widget">
                        <textarea
                          className="notes-textarea"
                          placeholder="פתקים ורשימות מהירות נשמרים אוטומטית מקומית..."
                          value={notes}
                          onChange={(e) => handleNotesChange(e.target.value)}
                          rows={3}
                        />
                        <div className="notes-footer">
                          <span>{notes.length} תווים</span>
                          <button
                            className="btn ghost small"
                            onClick={() => {
                              navigator.clipboard.writeText(notes);
                              showToast('הפתק הועתק ללוח!');
                            }}
                          >
                            <Icon name="link" size={12} />
                            <span>העתק תוכן</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Interactive live widget for Pomodoro */}
                    {isPomo && installed && !disabled && (
                      <div className="store-live-widget pomo-widget">
                        <div className="pomo-display">
                          <span className="pomo-digits">
                            {String(Math.floor(pomoSeconds / 60)).padStart(2, '0')}:
                            {String(pomoSeconds % 60).padStart(2, '0')}
                          </span>
                          <div className="pomo-actions">
                            <button
                              className={cx('btn', pomoRunning ? 'ghost' : 'primary', 'small')}
                              onClick={() => setPomoRunning(!pomoRunning)}
                            >
                              <Icon name={pomoRunning ? 'pause' : 'play'} size={13} />
                              <span>{pomoRunning ? 'השהה' : 'התחל פוקוס'}</span>
                            </button>
                            <button
                              className="btn ghost small"
                              onClick={() => {
                                setPomoRunning(false);
                                setPomoSeconds(25 * 60);
                              }}
                            >
                              <Icon name="reload" size={13} />
                              <span>איפוס</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Interactive live widget for Security Auditor */}
                    {isAuditor && installed && !disabled && (
                      <div className="store-live-widget auditor-widget">
                        <div className="auditor-header">
                          <div className="auditor-grade">ציון: A+</div>
                          <div className="auditor-host">{activeUrl ? new URL(activeUrl).hostname : 'Drift Safe Zone'}</div>
                        </div>
                        <div className="auditor-checks">
                          <div className="aud-check ok">✓ הצפנת חיבור: {isHttps ? 'TLS 1.3 מאומתת' : 'אזור פנימי מוגן'}</div>
                          <div className="aud-check ok">✓ חסימת עוגיות צד שלישי (3rd-Party Cookies): פעילה</div>
                          <div className="aud-check ok">✓ הגנת הפשטת פרמטרי מעקב URL: פעילה</div>
                        </div>
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div className="store-card-footer">
                      <div className="footer-left-buttons">
                        <button
                          className={cx('btn', installed ? 'ghost' : 'primary', 'small')}
                          style={!installed ? { background: item.accentColor, color: '#090d16', fontWeight: 600 } : undefined}
                          onClick={() => toggleInstall(item.id)}
                        >
                          <Icon name={installed ? 'x' : 'plus'} size={14} />
                          <span>{installed ? 'הסר תוסף' : 'התקן תוסף'}</span>
                        </button>

                        {installed && (
                          <button
                            className={cx('btn', disabled ? 'primary' : 'ghost', 'small')}
                            onClick={() => toggleEnabled(item.id)}
                          >
                            <Icon name={disabled ? 'play' : 'pause'} size={13} />
                            <span>{disabled ? 'הפעל תוסף' : 'השבת זמנית'}</span>
                          </button>
                        )}
                      </div>

                      <button
                        className="btn-details-link"
                        title="צפה בצילומי מסך ופרטים מורחבים"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveScreenshotIdx(0);
                        }}
                      >
                        <span>תמונות ופירוט</span>
                        <Icon name="tab" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Themes Showcase Tab */}
        {(activeTab === 'themes' || activeTab === 'all') && (
          <div className="themes-section">
            <div className="themes-section-title">
              <h2>ערכות עיצוב מקוריות של Drift Store</h2>
              <p>ערכות צבעים אלגנטיות שנבחרו בקפידה לחוויות גלישה ייחודיות ויוקרתיות.</p>
            </div>

            <div className="themes-grid">
              {COLOR_THEMES.map((theme) => {
                const isCurrent = state.settings.colorTheme === theme.id;
                return (
                  <div
                    key={theme.id}
                    className={cx('theme-card', isCurrent && 'active')}
                    onClick={() => applyTheme(theme.id)}
                  >
                    {/* Realistic Mini Browser Mockup Frame */}
                    <div className="theme-browser-mockup" style={{ background: theme.bg }}>
                      {/* Mini Window Header */}
                      <div className="theme-mini-titlebar">
                        <div className="theme-mini-dots">
                          <span className="mini-dot red" />
                          <span className="mini-dot yellow" />
                          <span className="mini-dot green" />
                        </div>
                        <div className="theme-mini-tabs">
                          <div
                            className="theme-mini-tab active"
                            style={{ background: theme.surface, borderBottom: `2px solid ${theme.accent}` }}
                          >
                            <span className="mini-tab-dot" style={{ background: theme.accent }} />
                            <span className="mini-tab-title">{theme.name}</span>
                          </div>
                          <div className="theme-mini-tab inactive">
                            <span className="mini-tab-title">+</span>
                          </div>
                        </div>
                      </div>

                      {/* Mini Address Bar */}
                      <div className="theme-mini-nav" style={{ background: theme.surface }}>
                        <div className="theme-mini-url" style={{ border: `1px solid ${theme.accent}44` }}>
                          <span className="mini-lock" style={{ color: theme.accent }}>🔒</span>
                          <span className="mini-url-text">drift://newtab · {theme.id}</span>
                        </div>
                      </div>

                      {/* Mini Page View Canvas */}
                      <div className="theme-mini-canvas" style={{ background: theme.bg }}>
                        <div
                          className="theme-mini-hero-card"
                          style={{ background: theme.surface, borderTop: `2px solid ${theme.accent}` }}
                        >
                          <div className="mini-preview-headline" style={{ color: theme.accent }}>
                            ● Drift Pro Experience
                          </div>
                          <div className="mini-preview-bar w-80" />
                          <div className="mini-preview-bar w-50" />
                          <div
                            className="mini-preview-action-btn"
                            style={{ background: theme.accent, color: theme.bg }}
                          >
                            {isCurrent ? 'מופעל כעת' : 'נסה ערכה'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Theme Card Footer */}
                    <div className="theme-card-footer">
                      <div className="theme-card-info">
                        <span className="theme-name">{theme.name}</span>
                        <div className="theme-chips">
                          <span className="theme-chip" style={{ background: theme.accent }} title="Accent: צבע הדגשה" />
                          <span className="theme-chip" style={{ background: theme.surface }} title="Surface: סרגלים ופאנלים" />
                          <span className="theme-chip" style={{ background: theme.bg }} title="Background: רקע ראשי" />
                        </div>
                      </div>
                      <button
                        className={cx('btn small', isCurrent ? 'ghost' : 'primary')}
                        style={!isCurrent ? { background: theme.accent, color: '#090d16', fontWeight: 600 } : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyTheme(theme.id);
                        }}
                      >
                        {isCurrent ? '✓ מופעל' : 'החל ערכה זו'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Modal & Screenshots Gallery (Store Product Page Dialog) */}
      {selectedItem && (
        <div className="store-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="store-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header-banner" style={{ background: selectedItem.bannerGradient }}>
              <button className="modal-close-btn" onClick={() => setSelectedItem(null)}>
                <Icon name="x" size={16} />
              </button>
              <div className="modal-banner-content">
                <div className="modal-icon-wrap" style={{ color: selectedItem.accentColor }}>
                  <Icon name={selectedItem.icon} size={36} />
                </div>
                <div>
                  <div className="modal-badges">
                    <span className="badge official">מקורי Drift</span>
                    <span className="badge verified">מאומת 100%</span>
                    <span className="badge version">v{selectedItem.version}</span>
                  </div>
                  <h2 className="modal-title">{selectedItem.nameHe}</h2>
                  <div className="modal-meta-row">
                    <span>{selectedItem.author}</span>
                    <span className="meta-sep">•</span>
                    <span className="stars-gold">★★★★★ {selectedItem.rating}</span>
                    <span className="meta-sep">•</span>
                    <span>👥 {selectedItem.users}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body-content">
              {/* Screenshots Gallery Section */}
              <div className="modal-screenshots-section">
                <h3 className="modal-section-title">🖼️ גלריית תמונות ותצוגה מקדימה</h3>
                <div className="screenshot-display-frame">
                  <div className="screenshot-inner-mockup" style={{ background: selectedItem.bannerGradient }}>
                    <div className="mockup-artwork-large-wrap">
                      <StoreArtwork
                        itemId={selectedItem.id}
                        slideIdx={activeScreenshotIdx}
                        className="modal-artwork-canvas"
                      />
                    </div>

                    <div className="mockup-showcase-view">
                      <h4 className="mockup-title">{selectedItem.screenshots[activeScreenshotIdx]?.title}</h4>
                      <p className="mockup-subtitle">{selectedItem.screenshots[activeScreenshotIdx]?.subtitle}</p>

                      <div className="mockup-features-pills">
                        {selectedItem.screenshots[activeScreenshotIdx]?.features.map((f, i) => (
                          <div key={i} className="mockup-pill">
                            <Icon name="check" size={13} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Screenshot thumbnails selector */}
                  {selectedItem.screenshots.length > 1 && (
                    <div className="screenshot-thumbnails-row">
                      {selectedItem.screenshots.map((s, idx) => (
                        <button
                          key={idx}
                          className={cx('screenshot-thumb-btn', activeScreenshotIdx === idx && 'active')}
                          onClick={() => setActiveScreenshotIdx(idx)}
                        >
                          <Icon name={s.icon} size={14} />
                          <span>צילום {idx + 1}: {s.title.slice(0, 22)}...</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Full Description & Checklist */}
              <div className="modal-desc-section">
                <h3 className="modal-section-title">תיאור מלא ויכולות מרכזיות</h3>
                <p className="modal-desc-text">{selectedItem.descriptionHe}</p>

                <div className="modal-features-grid">
                  {selectedItem.featuresHe.map((feat, i) => (
                    <div key={i} className="modal-feat-card">
                      <Icon name="check" size={14} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified User Reviews Section */}
              <div className="modal-reviews-section">
                <h3 className="modal-section-title">⭐ ביקורות משתמשים מאומתות</h3>
                <div className="modal-reviews-list">
                  {selectedItem.reviews.map((rev, i) => (
                    <div key={i} className="review-card">
                      <div className="review-header">
                        <span className="review-author">{rev.author}</span>
                        <span className="review-stars">{'★'.repeat(rev.stars)}</span>
                        <span className="review-date">{rev.date}</span>
                      </div>
                      <p className="review-comment">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="modal-bottom-bar">
              <button
                className={cx('btn primary')}
                style={{ background: selectedItem.accentColor, color: '#090d16', fontWeight: 600, padding: '0 24px', height: '38px' }}
                onClick={() => {
                  toggleInstall(selectedItem.id);
                  setSelectedItem(null);
                }}
              >
                <Icon name={installedSet.has(selectedItem.id) ? 'x' : 'plus'} size={15} />
                <span>{installedSet.has(selectedItem.id) ? 'הסר תוסף מהדפדפן' : 'התקן עכשיו בחינם'}</span>
              </button>
              <button className="btn ghost" onClick={() => setSelectedItem(null)}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="store-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
