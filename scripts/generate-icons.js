const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const iconDirectory = path.join(root, "public/icons");

async function generateIcons() {
  const source = await fs.readFile(path.join(iconDirectory, "workaround.svg"));
  const images = new Map();
  for (const size of [16, 32, 48, 96, 128, 256, 512]) {
    const png = await sharp(source).resize(size, size).png().toBuffer();
    images.set(size, png);
    await fs.writeFile(path.join(iconDirectory, `icon${size}.png`), png);
  }

  // An ICO directory can contain PNG frames directly; no second rasterizer needed.
  const faviconSizes = [16, 32, 48];
  const directory = Buffer.alloc(6 + 16 * faviconSizes.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(faviconSizes.length, 4);
  let offset = directory.length;
  for (const [index, size] of faviconSizes.entries()) {
    const entry = 6 + index * 16,
      image = images.get(size);
    directory[entry] = size;
    directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  }
  await fs.writeFile(
    path.join(root, "src/app/favicon.ico"),
    Buffer.concat([directory, ...faviconSizes.map((size) => images.get(size))]),
  );
  console.log(
    "Generated extension icons (16–512 px) and favicon from workaround.svg.",
  );
}

generateIcons().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
