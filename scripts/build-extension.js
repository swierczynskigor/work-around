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

  // --- Fix for Chrome Extension (no _next folder allowed) ---
  console.log('Post-processing Next.js export for Chrome Extension...');
  
  // 1. Rename _next to next
  const nextDir = path.join(outDir, '_next');
  const newNextDir = path.join(outDir, 'next');
  if (await fs.pathExists(nextDir)) {
      await fs.move(nextDir, newNextDir, { overwrite: true });
  }

  // 2. Delete other files starting with _ or . in root
  const rootFiles = await fs.readdir(outDir);
  for (const file of rootFiles) {
      if (file.startsWith('_') || file.startsWith('.')) {
         // Skip if it's the new 'next' directory (it doesn't start with _), 
         // but we need to delete _not-found, __next*, .DS_Store etc.
         // We already moved _next, so it shouldn't exist, but just in case.
         const filePath = path.join(outDir, file);
         await fs.remove(filePath);
      }
  }

  // 3. Replace /_next/ with /next/ in all HTML/JS/CSS files
  async function replaceInFile(filePath) {
      const ext = path.extname(filePath);
      if (['.html', '.js', '.css', '.json'].includes(ext)) {
          let content = await fs.readFile(filePath, 'utf8');
          if (content.includes('/_next/')) {
              content = content.replace(/\/_next\//g, '/next/');
              await fs.writeFile(filePath, content);
          }
      }
  }

  async function processDirectory(dir) {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
              await processDirectory(fullPath);
          } else {
              await replaceInFile(fullPath);
          }
      }
  }

  await processDirectory(outDir);

  console.log('Extension build complete.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
