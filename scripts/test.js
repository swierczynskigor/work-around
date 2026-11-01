const { buildSync } = require("esbuild");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const directory = mkdtempSync(join(tmpdir(), "workaround-tests-"));
try {
  const files = ["core", "background"].map((name) => {
    const outfile = join(directory, `${name}.test.cjs`);
    buildSync({
      entryPoints: [`tests/${name}.test.ts`],
      outfile,
      platform: "node",
      target: "node20",
      bundle: true,
      logLevel: "silent",
    });
    return outfile;
  });
  const firefoxBackground = join(directory, "background.firefox.test.cjs");
  buildSync({
    entryPoints: ["tests/background.test.ts"],
    outfile: firefoxBackground,
    platform: "node",
    target: "node20",
    bundle: true,
    define: {
      chrome: "browser",
      "process.env.WORKAROUND_TEST_BROWSER": '"firefox"',
    },
    logLevel: "silent",
  });
  files.push(firefoxBackground);
  const result = spawnSync(process.execPath, ["--test", ...files], {
    stdio: "inherit",
    env: { ...process.env, TZ: "Europe/Warsaw" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
