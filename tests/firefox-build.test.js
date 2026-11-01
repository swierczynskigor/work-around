const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { buildFirefox, firefoxManifest } = require("../scripts/build-firefox");
const chromeManifest = require("../manifest.json");

test("Firefox manifest uses event pages and a stable ID without mutating Chrome configuration", () => {
  const original = structuredClone(chromeManifest);
  const firefox = firefoxManifest(chromeManifest);
  assert.deepEqual(firefox.background, { scripts: ["background.js"] });
  assert.equal(firefox.browser_specific_settings.gecko.id, "workaround@local");
  assert.equal(firefox.minimum_chrome_version, undefined);
  assert.deepEqual(chromeManifest, original);
  assert.deepEqual(firefox.permissions, chromeManifest.permissions);
});

test("Firefox packaging adapts APIs in all contexts, preserves strings and Chrome output, and removes stale files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workaround-firefox-build-"));
  const sourceDir = join(directory, "chrome"),
    destinationDir = join(directory, "firefox");
  try {
    await mkdir(join(sourceDir, "next", "static", "chunks"), {
      recursive: true,
    });
    const script =
      'globalThis.answer = chrome.runtime.id; globalThis.literal = "chrome.runtime.id"; globalThis.available = typeof chrome !== "undefined";';
    const files = {
      "manifest.json": JSON.stringify(chromeManifest),
      "background.js": script,
      "content.js": script,
      "popup.html": '<script src="./script-popup.js"></script>',
      "options.html": '<script src="./script-popup.js"></script>',
      "script-popup.js": script,
      "next/static/chunks/ui.js": script,
    };
    for (const [file, content] of Object.entries(files))
      await writeFile(join(sourceDir, file), content);
    await mkdir(destinationDir);
    await writeFile(join(destinationDir, "obsolete.js"), "old");
    await buildFirefox({ sourceDir, destinationDir });
    assert.equal(
      (await readdir(destinationDir)).includes("obsolete.js"),
      false,
    );
    for (const file of [
      "background.js",
      "content.js",
      "script-popup.js",
      "next/static/chunks/ui.js",
    ]) {
      const context = { browser: { runtime: { id: "firefox-extension" } } };
      runInNewContext(
        await readFile(join(destinationDir, file), "utf8"),
        context,
      );
      assert.equal(context.answer, "firefox-extension");
      assert.equal(context.available, true);
      assert.equal(context.literal, "chrome.runtime.id");
    }
    for (const [file, content] of Object.entries(files))
      assert.equal(await readFile(join(sourceDir, file), "utf8"), content);
    const manifest = JSON.parse(
      await readFile(join(destinationDir, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(
      manifest.browser_specific_settings.gecko.strict_min_version,
      "128.0",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Firefox packaging rejects missing or shared input before modifying an existing output", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "workaround-firefox-invalid-"),
  );
  try {
    const sourceDir = join(directory, "missing"),
      destinationDir = join(directory, "existing");
    await mkdir(destinationDir);
    await writeFile(join(destinationDir, "preserved.txt"), "keep");
    await assert.rejects(
      buildFirefox({ sourceDir, destinationDir }),
      /Missing manifest.json/,
    );
    assert.equal(
      await readFile(join(destinationDir, "preserved.txt"), "utf8"),
      "keep",
    );
    await assert.rejects(
      buildFirefox({ sourceDir: destinationDir, destinationDir }),
      /separate/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
