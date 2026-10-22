// Export the original wordmark over the generated studio photograph.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const wordmark = await sharp(await readFile("public/brand/wordmark.svg")).resize({ width: 240 }).png().toBuffer();
const type = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade"><stop stop-color="#06080B" stop-opacity=".97"/><stop offset="1" stop-color="#06080B" stop-opacity=".15"/></linearGradient></defs><rect width="1200" height="630" fill="url(#shade)"/><g font-family="Arial, sans-serif" font-weight="700" font-size="78" fill="#F3EFE8"><text x="64" y="270">Play it.</text><text x="64" y="360" fill="#FF8A3D">Share the rig.</text><text x="64" y="450">Steal the tone.</text></g><text x="64" y="550" fill="#C9C3B8" font-size="22" font-family="Arial, sans-serif">The community for the sound behind the playing.</text></svg>`);
const file = "public/brand/og-studio.jpg";
await sharp("public/images/studio-guitar-1920.webp").resize(1200, 630, { fit: "cover" }).composite([{ input: type }, { input: wordmark, left: 64, top: 64 }]).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
const meta = await sharp(file).metadata();
assert.equal(meta.width, 1200);
assert.equal(meta.height, 630);
console.log(`${file}: ${meta.width}×${meta.height}`);
