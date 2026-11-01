const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

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

  // 3. Replace /_next/ with ./next/ in all HTML/JS/CSS files (relative paths for extension)
  async function replaceInFile(filePath) {
      const ext = path.extname(filePath);
      if (['.html', '.js', '.css', '.json'].includes(ext)) {
          let content = await fs.readFile(filePath, 'utf8');
          if (content.includes('/_next/')) {
              content = content.replace(/\/_next\//g, './next/');
              await fs.writeFile(filePath, content);
              console.log(`Fixed paths in ${path.basename(filePath)}`);
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

  // Process all files to fix paths BEFORE extracting scripts
  await processDirectory(outDir);

  // 4. Patch Next.js runtime to work with chrome-extension:// URLs
  // The Next.js runtime checks for './next/' in the script src path,
  // but Chrome extensions use chrome-extension://id/next/... URLs.
  // We need to patch the check to look for '/next/' instead of './next/'
  console.log('Patching Next.js runtime for Chrome Extension compatibility...');
  
  const chunksDir = path.join(outDir, 'next', 'static', 'chunks');
  if (await fs.pathExists(chunksDir)) {
    const chunkFiles = await fs.readdir(chunksDir);
    for (const chunkFile of chunkFiles) {
      if (chunkFile.endsWith('.js')) {
        const chunkPath = path.join(chunksDir, chunkFile);
        let content = await fs.readFile(chunkPath, 'utf8');
        
        // Patch: Replace the './next/' check with '/next/' check
        // This handles both relative (./next/) and absolute (chrome-extension://id/next/) paths
        if (content.includes('indexOf("./next/")')) {
          content = content.replace(
            /indexOf\("\.\/next\/"\)/g, 
            'indexOf("/next/")'
          );
          await fs.writeFile(chunkPath, content);
          console.log(`Patched Next.js runtime in ${chunkFile}`);
        }
        
        // Also patch the error message to be more helpful
        if (content.includes("Expected document.currentScript src to contain './next/'")) {
          content = content.replace(
            /Expected document\.currentScript src to contain '\.\/next\/'/g,
            "Expected document.currentScript src to contain '/next/'"
          );
          await fs.writeFile(chunkPath, content);
        }
      }
    }
  }

  // 4. Extract Inline Scripts to External Files (The "Un-Inline" Strategy)
  // This avoids CSP issues entirely by making all scripts external and local.
  const htmlFiles = ['popup.html', 'options.html']; 

  for (const htmlFile of htmlFiles) {
     const filePath = path.join(outDir, htmlFile);
     if (await fs.pathExists(filePath)) {
        let content = await fs.readFile(filePath, 'utf8');

        // Regex to match <script> tags with content.
        // We handle attributes by capturing them in group 1.
        // We match non-greedy content in group 2.
        // Note: We need a loop to handle multiple replacements safely.
        
        const newContent = content.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gm, (match, attrs, scriptContent) => {
            if (!scriptContent || scriptContent.trim().length === 0) {
                return match; // Empty script, keep as is (or it's src-only)
            }

            // Skip JSON data scripts
            if (attrs && (attrs.includes('type="application/json"') || attrs.includes('type="application/ld+json"'))) {
                return match;
            }

            // Extract content to file
            const hash = crypto.createHash('sha256').update(scriptContent).digest('hex').substring(0, 16);
            const fileName = `script-${htmlFile.replace('.html', '')}-${hash}.js`;
            const scriptPath = path.join(outDir, fileName);
            
            // Sync write is fine here for build script
            // Use fs-extra outputFileSync to ensure dir exists if we wanted subdirs
            fs.writeFileSync(scriptPath, scriptContent);
            console.log(`Extracted inline script to ${fileName}`);

            // Return new tag with src. 
            // We preserve existing attributes (like async, defer, type), but we must remove any existing src (there shouldn't be one if it had content).
            // Also need to ensure we don't duplicate attributes.
            // Safe bet: <script src="./fileName" attrs></script>
            return `<script src="./${fileName}" ${attrs}></script>`;
        });

        if (content !== newContent) {
             await fs.writeFile(filePath, newContent);
             console.log(`Updated ${htmlFile} with external script references.`);
        }
     }
  }

  // 5. Clean up Manifest (Remove custom CSP if it exists, let it use default 'self')
  // No need to add anything to manifest because 'self' covers local files.
  // But we should ensure we don't have leftover garbage from previous runs if user didn't clean.
  // Ideally, we start with a fresh manifest copy in step 1.
  
  console.log('Extension build complete.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
