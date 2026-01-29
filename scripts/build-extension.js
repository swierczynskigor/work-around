const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const outDir = path.join(__dirname, '../out');
const srcDir = path.join(__dirname, '../src');

async function build() {
  console.log('Building extension scripts...');

  // Ensure out directory exists
  await fs.ensureDir(outDir);

  // Build Background Script
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'background/index.ts')],
    outfile: path.join(outDir, 'background.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['es2020'],
  });

  // Build Content Script
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'content/index.ts')],
    outfile: path.join(outDir, 'content.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['es2020'],
  });

  // Copy manifest
  if (fs.existsSync(path.join(__dirname, '../manifest.json'))) {
      await fs.copy(path.join(__dirname, '../manifest.json'), path.join(outDir, 'manifest.json'));
  }

  console.log('Extension build complete.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
