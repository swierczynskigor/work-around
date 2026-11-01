const fs = require("fs-extra");
const path = require("node:path");
const esbuild = require("esbuild");

const REQUIRED_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "options.html",
];

function firefoxManifest(chromeManifest) {
  const manifest = structuredClone(chromeManifest);
  delete manifest.minimum_chrome_version;
  manifest.background = { scripts: ["background.js"] };
  manifest.browser_specific_settings = {
    ...manifest.browser_specific_settings,
    gecko: {
      ...manifest.browser_specific_settings?.gecko,
      id: "workaround@local",
      strict_min_version: "128.0",
    },
  };
  return manifest;
}

async function buildFirefox({
  sourceDir = path.join(__dirname, "../out"),
  destinationDir = path.join(__dirname, "../out-firefox"),
} = {}) {
  if (path.resolve(sourceDir) === path.resolve(destinationDir)) {
    throw new Error("Firefox output must be separate from the Chrome build.");
  }
  for (const file of REQUIRED_FILES) {
    if (!(await fs.pathExists(path.join(sourceDir, file)))) {
      throw new Error(
        `Missing ${file}. Run npm run build before packaging Firefox.`,
      );
    }
  }

  // Start from the processed static export, preserving the Chrome package.
  await fs.emptyDir(destinationDir);
  await fs.copy(sourceDir, destinationDir);
  const manifest = firefoxManifest(
    await fs.readJson(path.join(sourceDir, "manifest.json")),
  );
  await fs.writeJson(path.join(destinationDir, "manifest.json"), manifest, {
    spaces: 2,
  });

  async function adaptScripts(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await adaptScripts(filePath);
      } else if (entry.name.endsWith(".js")) {
        const result = await esbuild.transform(
          await fs.readFile(filePath, "utf8"),
          {
            loader: "js",
            target: "firefox128",
            // Rewrite identifiers, including typeof checks, without touching strings
            // or property names. This covers background, content and Next.js UI chunks.
            define: { chrome: "browser" },
            minify: true,
            legalComments: "inline",
          },
        );
        await fs.writeFile(filePath, result.code);
      }
    }
  }
  await adaptScripts(destinationDir);
  return destinationDir;
}

module.exports = { buildFirefox, firefoxManifest };

if (require.main === module) {
  buildFirefox()
    .then((directory) => {
      console.log(`Firefox / Zen build ready: ${directory}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
