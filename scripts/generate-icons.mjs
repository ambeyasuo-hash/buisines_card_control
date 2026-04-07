// (c) 2026 ambe / Business_Card_Folder
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const publicDir = path.join(root, "public");
const svgPath = path.join(publicDir, "icon.svg");

async function main() {
  const svg = await readFile(svgPath);

  // PNGs
  const png32 = await sharp(svg, { density: 240 })
    .resize(32, 32, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(publicDir, "favicon-32.png"), png32);

  const png180 = await sharp(svg, { density: 240 })
    .resize(180, 180, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(publicDir, "apple-touch-icon.png"), png180);

  // favicon.ico
  const ico = await pngToIco(png32);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

