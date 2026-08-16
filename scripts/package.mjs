import { createWriteStream, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "lingo");
const zipPath = join(outDir, "lingo.zip");

const DOC = "INSTRUCTIONS.md";

// Top-level entries shipped to the buyer. Directories are walked recursively.
const entries = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vercel.json",
  ".gitignore",
  ".env.example",
  "components.json",
  "eslint.config.js",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "playwright-fixture.ts",
  "README.md",
  DOC,
  "public",
  "src",
  "scripts",
];

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "lingo",
  ".vercel",
  ".vscode",
  "playwright-report",
  "test-results",
]);
const EXCLUDED_FILES = new Set([".env", "bun.lock", "bun.lockb"]);
const EXCLUDED_SUFFIXES = [".log", ".tsbuildinfo", ".map"];

function shouldExclude(rel) {
  const parts = rel.split("/");
  if (parts.some((p) => EXCLUDED_DIRS.has(p))) return true;
  if (EXCLUDED_FILES.has(rel)) return true;
  return EXCLUDED_SUFFIXES.some((s) => rel.endsWith(s));
}

function addPath(archive, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs) || shouldExclude(rel)) return;
  if (statSync(abs).isDirectory()) {
    archive.append(null, { name: rel.replaceAll("\\", "/") + "/" });
    for (const child of readdirSync(abs)) addPath(archive, `${rel}/${child}`);
  } else {
    archive.file(abs, { name: rel.replaceAll("\\", "/") });
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const output = createWriteStream(zipPath);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.on("warning", (w) => console.warn("warning:", w.message));
archive.on("error", (e) => {
  throw e;
});
archive.pipe(output);

for (const entry of entries) addPath(archive, entry);

await archive.finalize();

await new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
});

copyFileSync(join(root, DOC), join(outDir, DOC));

console.log(`Created ${zipPath} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
console.log(`Instructions copied to ${join(outDir, DOC)}`);
