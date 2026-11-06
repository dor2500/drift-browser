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
