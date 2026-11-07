// Renders assets/icon.svg into the PNG sizes and the Windows .ico Drift needs.
// Usage: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('assets/icon.svg', 'utf8');
const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

mkdirSync('assets/png', { recursive: true });
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngs = new Map(sizes.map((s) => [s, render(s)]));
for (const [s, buf] of pngs) writeFileSync(`assets/png/icon-${s}.png`, buf);
writeFileSync('assets/icon.png', pngs.get(512));

// .ico with PNG-compressed entries (supported since Windows Vista).
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(icoSizes.length, 4);
const dir = Buffer.alloc(16 * icoSizes.length);
let offset = header.length + dir.length;
icoSizes.forEach((s, i) => {
  const png = pngs.get(s);
  const e = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e); // width (0 means 256)
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1); // height
  dir.writeUInt8(0, e + 2); // palette
  dir.writeUInt8(0, e + 3); // reserved
  dir.writeUInt16LE(1, e + 4); // colour planes
  dir.writeUInt16LE(32, e + 6); // bits per pixel
  dir.writeUInt32LE(png.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
writeFileSync('assets/icon.ico', Buffer.concat([header, dir, ...icoSizes.map((s) => pngs.get(s))]));

// The shell uses the SVG as its favicon and in the first-run dialog.
mkdirSync('public', { recursive: true });
copyFileSync('assets/icon.svg', 'public/icon.svg');

console.log(`icons: ${sizes.join(', ')}px PNG, icon.ico (${icoSizes.join('/')}), public/icon.svg`);

// Android launcher icons: adaptive (foreground symbol + solid background) and
// legacy full icons, at every density.
const res = 'android/app/src/main/res';
const symbolOnly = svg
  .replace(/<rect x="64" y="64"[^>]*fill="url\(#bg\)"\/>/, '')
  .replace(/<rect x="64" y="64"[^>]*fill="url\(#glow\)"\/>/, '')
  .replace(/<rect x="66" y="66"[^>]*\/>/, '')
  // Fit the symbol inside the adaptive-icon safe zone (centre 66 of 108 dp).
  .replace(/(<\/defs>)/, '$1<g transform="translate(512 512) scale(0.62) translate(-542 -519)">')
  .replace(/<\/svg>\s*$/, '</g></svg>');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  mkdirSync(`${res}/mipmap-${d}`, { recursive: true });
  writeFileSync(`${res}/mipmap-${d}/ic_launcher_foreground.png`, new Resvg(symbolOnly, { fitTo: { mode: 'width', value: Math.round(108 * k) } }).render().asPng());
  writeFileSync(`${res}/mipmap-${d}/ic_launcher.png`, render(Math.round(48 * k)));
}
mkdirSync(`${res}/mipmap-anydpi-v26`, { recursive: true });
writeFileSync(
  `${res}/mipmap-anydpi-v26/ic_launcher.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`,
);
writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#191C2C</color>\n</resources>\n`);
console.log('android launcher icons written');
