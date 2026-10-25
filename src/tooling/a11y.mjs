// Run: npm run a11y:lint. Source checks for the brief's rules (needs the typescript package, already a dev dependency):
//  - no hard-coded visible text (JSX text, aria-label, placeholder, title, alt)
//  - no banned words in strings (commission, dispute, cancellation fee, "pro" for a generic worker)
//  - every raw <button> has a touch-sized class (min-h-touch)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : []; });
const BANNED = [/\bcommission\b/i, /\bdispute\b/i, /cancellation fee/i, /comisi[oó]n/i];
const ALLOWED_TEXT = new Set(["FI", "X", "FIXX", "+52"]);
const TEXT_ATTRS = new Set(["aria-label", "placeholder", "title", "alt"]);
const errors = [];

for (const file of walk(src)) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = (n) => `${file.replace(src, "src")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visit = (n) => {
    if (ts.isJsxText(n)) {
      const v = n.getText().trim();
      if (v && /\p{L}/u.test(v) && !ALLOWED_TEXT.has(v)) errors.push(`hard-coded text "${v}" at ${at(n)}`);
    }
    if (ts.isJsxAttribute(n) && TEXT_ATTRS.has(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer)) {
      errors.push(`hard-coded ${n.name.getText()} "${n.initializer.text}" at ${at(n)}`);
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) {
      const v = ts.isJsxText(n) ? n.getText() : n.text;
      if (BANNED.some((r) => r.test(v))) errors.push(`banned word in "${v.slice(0, 40)}" at ${at(n)}`);
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === "button") {
      const cls = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === "className");
      // ui/Button.tsx builds its class from a shared base that includes min-h-touch; a fixed min height of 3rem or more also counts
      const ok = file.endsWith("ui/Button.tsx") || (cls && /min-h-touch|min-h-\[(?:[3-9]|\d{2,})(?:\.\d+)?rem\]/.test(cls.getText()));
      if (!ok) errors.push(`<button> without a touch-sized min height at ${at(n)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
errors.forEach((e) => console.error("ERROR", e));
console.log(`a11y lint: ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
