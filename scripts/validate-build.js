const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../out');
const REQUIRED_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'options.html'
];
const FORBIDDEN_PATHS = [
  '_next' // Chrome doesn't allow folders starting with _
];

console.log('🔍 Validating build output for Chrome Extension compatibility...');

if (!fs.existsSync(OUT_DIR)) {
  console.error('❌ Error: "out" directory not found. Run "npm run build" first.');
  process.exit(1);
}

let hasError = false;

// 1. Check required files
for (const file of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(OUT_DIR, file))) {
    console.error(`❌ Error: Missing required file "${file}"`);
    hasError = true;
  } else {
    console.log(`✅ Found "${file}"`);
  }
}

// 2. Check forbidden paths
for (const forbidden of FORBIDDEN_PATHS) {
  if (fs.existsSync(path.join(OUT_DIR, forbidden))) {
    console.error(`❌ Error: Found forbidden path "${forbidden}". Chrome will reject this.`);
    hasError = true;
  } else {
    console.log(`✅ Validated no "${forbidden}" folder`);
  }
}

// 3. Check for icons
const iconDir = path.join(OUT_DIR, 'icons');
if (fs.existsSync(iconDir)) {
    const icons = fs.readdirSync(iconDir);
    if (icons.length === 0) {
        console.warn('⚠️ Warning: "icons" folder is empty.');
    } else {
        console.log(`✅ Found ${icons.length} icons in "icons/"`);
    }
} else {
    console.warn('⚠️ Warning: "icons" folder missing.');
}

if (hasError) {
  console.log('\n💥 Validation FAILED.');
  process.exit(1);
} else {
  console.log('\n✨ Validation PASSED. Ready to load into Chrome.');
  process.exit(0);
}
