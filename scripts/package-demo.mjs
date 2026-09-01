import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const outDir = join(root, "lingo");
const zipPath = join(outDir, "lingo-demo.zip");

if (!existsSync(distDir)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
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

function addDir(abs, prefix) {
  for (const child of readdirSync(abs)) {
    const childAbs = join(abs, child);
    const rel = prefix ? `${prefix}/${child}` : child;
    if (statSync(childAbs).isDirectory()) {
      archive.append(null, { name: rel.replaceAll("\\", "/") + "/" });
      addDir(childAbs, rel);
    } else {
      archive.file(childAbs, { name: rel.replaceAll("\\", "/") });
    }
  }
}

addDir(distDir, "");
archive.file(join(root, "DEMO-QUICKSTART.md"), { name: "DEMO-QUICKSTART.md" });

await archive.finalize();

await new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
});

console.log(`Created ${zipPath} (${(archive.pointer() / 1024).toFixed(1)} KB)`);