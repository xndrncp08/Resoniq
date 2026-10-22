// Rasterizes the SVG brand marks into the PNG/ICO sizes browsers and app launchers want.
//   node scripts/brand-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const mark = await readFile(new URL("../public/brand/app-icon.svg", import.meta.url));
for (const size of [512, 192, 180]) {
  await sharp(mark, { density: 384 }).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/brand/app-icon-${size}.png`, import.meta.url)));
}
// A single-image ICO holding a 32px PNG (supported by every current browser).
const png = await sharp(await readFile(new URL("../public/brand/favicon.svg", import.meta.url)), { density: 384 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([header, png]));
console.log("Wrote app-icon-512/192/180.png and favicon.ico");
