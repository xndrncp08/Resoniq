// Renders brand SVGs to PNG previews (for design review only; not shipped).
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const [, , input, output, width = "512"] = process.argv;
await sharp(await readFile(input), { density: 300 }).resize({ width: Number(width) }).png().toFile(output);
