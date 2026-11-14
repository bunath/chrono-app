import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Usage: node scripts/set-version.mjs <version>");
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
packageJson.version = version;
await writeFile("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriConfig = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));
tauriConfig.version = version;
await writeFile("src-tauri/tauri.conf.json", `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoPath = "src-tauri/Cargo.toml";
const cargoToml = await readFile(cargoPath, "utf8");
const updatedCargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
await writeFile(cargoPath, updatedCargoToml);

process.stdout.write(`Version synchronisée : ${version}\n`);
