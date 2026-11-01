const fs = require("fs");
const path = require("path");

const firefox = process.argv.includes("--firefox");
const target = firefox ? "Firefox / Zen" : "Chrome";
const OUT_DIR = path.join(__dirname, firefox ? "../out-firefox" : "../out");
const REQUIRED_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "options.html",
];
const FORBIDDEN_PATHS = [
  "_next", // Chrome doesn't allow folders starting with _
];

console.log(`🔍 Validating build output for ${target}...`);

if (!fs.existsSync(OUT_DIR)) {
  console.error(
    `❌ Error: Build directory not found. Run npm run ${firefox ? "build:firefox" : "build"} first.`,
  );
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
    console.error(
      `❌ Error: Found forbidden path "${forbidden}". The static export has not been processed.`,
    );
    hasError = true;
  } else {
    console.log(`✅ Validated no "${forbidden}" folder`);
  }
}

// Verify the browser-specific background model and every declared entry point.
const manifestPath = path.join(OUT_DIR, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const errors = [];
  if (firefox) {
    if (
      manifest.background?.service_worker ||
      !manifest.background?.scripts?.includes("background.js")
    )
      errors.push(
        "Firefox requires background.scripts instead of service_worker",
      );
    if (!manifest.browser_specific_settings?.gecko?.id)
      errors.push("Firefox requires a stable extension ID for sync storage");
    if (manifest.minimum_chrome_version)
      errors.push("Firefox manifest contains minimum_chrome_version");
  } else if (manifest.background?.service_worker !== "background.js")
    errors.push("Chrome requires its background service worker");
  const entries = [
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...(manifest.background?.scripts || []),
    manifest.background?.service_worker,
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap((script) => script.js || []),
  ].filter(Boolean);
  for (const entry of entries)
    if (!fs.existsSync(path.join(OUT_DIR, entry)))
      errors.push(`Manifest references a missing file: ${entry}`);
  for (const error of errors) {
    console.error(`❌ ${error}`);
    hasError = true;
  }
  if (!errors.length)
    console.log(`✅ ${target} manifest and entry points are valid`);
}

// PNG exports must match the sizes advertised to the browser.
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const icons = { ...manifest.icons, ...manifest.action?.default_icon };
  for (const [size, icon] of Object.entries(icons)) {
    const iconPath = path.join(OUT_DIR, icon);
    if (!icon.endsWith(".png") || !fs.existsSync(iconPath)) continue;
    const png = fs.readFileSync(iconPath);
    const validHeader =
      png.length >= 24 &&
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (
      !validHeader ||
      png.readUInt32BE(16) !== Number(size) ||
      png.readUInt32BE(20) !== Number(size)
    ) {
      console.error(
        `❌ Icon ${icon} does not match its declared ${size} × ${size} size`,
      );
      hasError = true;
    }
  }
}

// 3. Check for icons
const iconDir = path.join(OUT_DIR, "icons");
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
  console.log("\n💥 Validation FAILED.");
  process.exit(1);
} else {
  console.log(`\n✨ Validation PASSED. Ready to load into ${target}.`);
  process.exit(0);
}
