// Run: npm run i18n:lint  (no dependencies; plain Node)
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const langs = ["en", "es", "ko"];
const BTN_MAX = 24, HEADLINE_MAX = 40;
const banned = [/\bcommission\b/i, /\bdispute\b/i, /cancellation fee/i, /\bpro\b/i, /comisi[oó]n/i, /disputa/i, /수수료/];
const errors = [], warns = [];

const files = readdirSync(join(root, "en")).filter((f) => f.endsWith(".json"));
const placeholders = (s) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join(",");

for (const f of files) {
  const data = Object.fromEntries(langs.map((l) => [l, JSON.parse(readFileSync(join(root, l, f), "utf8"))]));
  const keys = new Set(langs.flatMap((l) => Object.keys(data[l])));
  for (const k of keys) {
    for (const l of langs) {
      const e = data[l][k];
      if (!e) { if (!(l === "ko" && k.startsWith("admin."))) errors.push(`[${l}] missing key ${k} in ${f}`); continue; } // Admin and Support consoles are English and Spanish only
      if (typeof e.text !== "string" || !e.status) errors.push(`[${l}] ${k}: needs {text,status}`);
      if (l === "ko" && e.status !== "approved" && !e.needsNativeReview) errors.push(`[ko] ${k}: missing needsNativeReview`);
      if (data.en[k] && placeholders(e.text) !== placeholders(data.en[k].text)) errors.push(`[${l}] ${k}: placeholder mismatch`);
      { let d = 0, ok = true; for (const ch of e.text) { if (ch === "{") d++; if (ch === "}") { d--; if (d < 0) ok = false; } } if (d !== 0 || !ok) errors.push(`[${l}] ${k}: unbalanced braces (a raw placeholder would show)`); }
      if (banned.some((r) => r.test(e.text.replace(/FIXX Pro\b/g, "")))) errors.push(`[${l}] ${k}: banned term`);
      if (k.startsWith("btn.") && [...e.text].length > BTN_MAX) warns.push(`[${l}] ${k}: button over ${BTN_MAX} chars`);
      if (k.endsWith(".title") && [...e.text].length > HEADLINE_MAX) warns.push(`[${l}] ${k}: headline over ${HEADLINE_MAX} chars`);
    }
  }
}
warns.forEach((w) => console.warn("WARN ", w));
errors.forEach((e) => console.error("ERROR", e));
console.log(`i18n lint: ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
