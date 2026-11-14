import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const htmlFiles = ["src/index.html", "src/update.html", "src/splash.html"];
const sourceFiles = ["scripts", "tests", "src"];
const files = [];
let failed = false;

async function collect(directory) {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(relative);
    else if (/\.(?:m?js)$/.test(entry.name)) files.push(relative);
  }
}

for (const directory of sourceFiles) await collect(directory);
for (const file of htmlFiles) {
  const html = await readFile(resolve(root, file), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  for (const [index, match] of scripts.entries()) {
    const result = spawnSync(process.execPath, ["--check", "-"], {
      input: match[1],
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failed = true;
      process.stderr.write(`\n${file} — script inline n°${index + 1}\n${result.stderr}`);
    }
  }
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`\n${file}\n${result.stderr}`);
  }
}

if (failed) process.exit(1);
process.stdout.write("Tous les scripts JavaScript sont syntaxiquement valides.\n");
