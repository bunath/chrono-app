import { readFile } from "node:fs/promises";
import { ESLint } from "eslint";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.js" });
const files = ["src/index.html", "src/update.html", "src/splash.html"];
const results = await eslint.lintFiles(["scripts/**/*.mjs", "tests/**/*.mjs", "src/**/*.js"]);

for (const file of files) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  for (const [index, match] of scripts.entries()) {
    results.push(
      ...(await eslint.lintText(match[1], {
        filePath: `${file.replace(/\.html$/, "")}.inline-${index + 1}.js`,
      })),
    );
  }
}

const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results);
if (output) process.stdout.write(output);
const errors = results.reduce((total, result) => total + result.errorCount, 0);
if (errors > 0) process.exit(1);
process.stdout.write("Lint des scripts intégrés terminé.\n");
