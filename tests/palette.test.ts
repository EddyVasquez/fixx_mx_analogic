import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { colors } from "../src/ui/tokens";

/**
 * Hex colors that are not neutral greys, and the files allowed to contain them.
 * Lime #DFFF32 is the accent token: action buttons, selected states, and glow
 * edges only. Amber is the pending-review banner. Black and white stay only
 * in the high-contrast override.
 */
export const PALETTE_ALLOWLIST: Record<string, readonly string[]> = {
  DFFF32: ["src/ui/tokens.ts", "src/features/customer/jobChips.css"],
  FFE8A3: ["src/ui/tokens.ts"],
  "3F2A00": ["src/ui/tokens.ts"],
  FFFFFF: ["src/app/index.css"],
  "000000": ["src/app/index.css"]
};

const CHROMA_CLASS = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|divide|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white)(?:-\d{2,3})?\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPng(buf: Buffer): { width: number; height: number; data: Buffer; channels: number } {
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("not a png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported png ${bitDepth}/${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * channels);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[src++] ?? 0;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const x = row[i] ?? 0;
      const a = i >= channels ? cur[i - channels] ?? 0 : 0;
      const b = prev[i] ?? 0;
      const c = i >= channels ? prev[i - channels] ?? 0 : 0;
      let value = x;
      if (filter === 1) value = (x + a) & 255;
      else if (filter === 2) value = (x + b) & 255;
      else if (filter === 3) value = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) value = (x + paeth(a, b, c)) & 255;
      else if (filter !== 0) throw new Error(`png filter ${filter}`);
      cur[i] = value;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, data: out, channels };
}

describe("greyscale palette", () => {
  it("keeps source colors neutral, with the allowlist for lime, amber, and high contrast", () => {
    const root = process.cwd();
    const files = [...walk(join(root, "src")), join(root, "index.html"), join(root, "vite.config.ts")];
    const problems: string[] = [];
    for (const file of files) {
      const rel = file.replace(`${root}/`, "");
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
        let hex = (match[1] ?? "").toUpperCase();
        if (hex.length === 3) hex = hex.split("").map((channel) => channel + channel).join("");
        if (hex.length === 8) hex = hex.slice(0, 6);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const neutral = r === g && g === b;
        const nearWhite = neutral && r >= 246;
        if (neutral && !nearWhite) continue;
        const allowed = PALETTE_ALLOWLIST[hex] ?? [];
        if (!allowed.includes(rel)) problems.push(`${rel}: #${hex}`);
      }
      for (const match of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        if (!(r === g && g === b)) problems.push(`${rel}: rgb(${r},${g},${b})`);
      }
      for (const match of src.matchAll(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        if (!(r === g && g === b)) problems.push(`${rel}: rgb(${r} ${g} ${b})`);
      }
      if (CHROMA_CLASS.test(src)) problems.push(`${rel}: chromatic color class`);
    }
    expect(problems).toEqual([]);
  });

  it("paints the house fallback on the section grey, without a white or blue field", () => {
    const paper = parseInt(colors.paper.slice(1), 16);
    const channel = (paper >> 16) & 255;
    expect(channel).toBe((paper >> 8) & 255);
    expect(channel).toBeLessThan(246);
    const png = readPng(readFileSync(join(process.cwd(), "public/models/santa-sofia-house.png")));
    const { width, height, data, channels } = png;
    const corner = [0, 1, 2].map((offset) => data[offset]);
    expect(corner).toEqual([channel, channel, channel]);
    let nearWhite = 0;
    let blue = 0;
    const pixels = width * height;
    for (let i = 0; i < pixels; i++) {
      const r = data[i * channels] ?? 0;
      const g = data[i * channels + 1] ?? 0;
      const b = data[i * channels + 2] ?? 0;
      if (r >= 246 && g >= 246 && b >= 246) nearWhite += 1;
      if (b > r + 12 && b > g + 12) blue += 1;
    }
    expect(nearWhite / pixels).toBeLessThan(0.01);
    expect(blue).toBe(0);
  });
});
