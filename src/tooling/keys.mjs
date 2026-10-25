// Run: npm run i18n:keys. Every translation key used in the screens must exist in EN, ES and KO (admin.* keys: EN and ES).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const langs = ["en", "es", "ko"];
const keys = Object.fromEntries(langs.map((l) => {
  const all = new Set();
  for (const f of readdirSync(join(src, "i18n", l)).filter((x) => x.endsWith(".json"))) {
    for (const k of Object.keys(JSON.parse(readFileSync(join(src, "i18n", l, f), "utf8")))) all.add(k);
  }
  return [l, all];
}));

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : []; });
const errors = [];
for (const file of walk(src)) {
  const s = readFileSync(file, "utf8");
  for (const m of s.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
    for (const l of langs) {
      if (l === "ko" && m[1].startsWith("admin.")) continue;
      if (!keys[l].has(m[1])) errors.push(`[${l}] ${m[1]} (${file.replace(src, "src")})`);
    }
  }
  for (const m of s.matchAll(/\bt\(\s*`([\w.]+\.)\$\{/g)) {
    for (const l of langs) {
      if (l === "ko" && m[1].startsWith("admin.")) continue;
      if (![...keys[l]].some((k) => k.startsWith(m[1]))) errors.push(`[${l}] no keys start with ${m[1]} (${file.replace(src, "src")})`);
    }
  }
}
errors.forEach((e) => console.error("ERROR missing", e));
console.log(`i18n keys: ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
