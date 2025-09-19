import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const src = path.resolve('public/icons/icon.svg');
const outDir = path.resolve('public/icons');
const sizes = [16, 32, 48, 128];

async function main() {
  await fs.access(src).catch(() => {
    throw new Error(`Source SVG not found at ${src}`);
  });
  await Promise.all(
    sizes.map(async (size) => {
      const out = path.join(outDir, `icon-${size}.png`);
      const buf = await sharp(src, { density: 384 }) // higher density for crisp downscale
        .resize(size, size, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toBuffer();
      await fs.writeFile(out, buf);
      // eslint-disable-next-line no-console
      console.log(`wrote ${out}`);
    })
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
