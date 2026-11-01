// Dev-only placeholder artworks: soft colour-field paintings (blurred bands of colour),
// so the sample catalogue looks like paintings rather than clip-art.
// Run: node scripts/make-sample-art.mjs
import { writeFileSync } from "node:fs";

const PALETTES = [
  ["#e26d4a", "#f1b55f", "#7a2f3b"],
  ["#3d5a99", "#7fa3d6", "#1f2b4d"],
  ["#c94f6d", "#f3a6a0", "#5b2140"],
  ["#2f7d6b", "#a8d5b5", "#183f37"],
  ["#6b3cff", "#ff7eb6", "#2b2060"],
  ["#e8b04a", "#f6d79a", "#9c4a2a"],
  ["#24406e", "#5f86c4", "#13223d"],
  ["#d36a8a", "#f2c3c9", "#6e2b46"],
  ["#3c7a64", "#9fcfb1", "#1d3d33"],
  ["#ff9d4d", "#ffd3a8", "#8a3b1f"],
  ["#5a4bb5", "#b9b0f0", "#231d52"],
  ["#c4562a", "#f0c49a", "#4b2a20"],
  ["#2bb5a0", "#c9f0e6", "#11463e"],
  ["#ff5fa2", "#ffd3e8", "#5c1a3c"],
];
const sizes = [[800, 1000], [900, 720], [800, 800], [760, 960]];

function art(i, [w, h], [a, b, c]) {
  const id = `b${i}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.round(w / 40)}"/></filter>
<radialGradient id="g${i}" cx="50%" cy="28%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="${c}"/>
<g filter="url(#${id})">
<rect x="${w * 0.08}" y="${h * 0.07}" width="${w * 0.84}" height="${h * (0.36 + (i % 3) * 0.04)}" rx="${w * 0.03}" fill="${a}"/>
<rect x="${w * 0.1}" y="${h * (0.5 + (i % 2) * 0.03)}" width="${w * 0.8}" height="${h * 0.3}" rx="${w * 0.03}" fill="${b}"/>
</g>
<rect width="${w}" height="${h}" fill="url(#g${i})"/>
</svg>
`;
}

PALETTES.forEach((p, i) => {
  writeFileSync(new URL(`../public/samples/art-${String(i + 1).padStart(2, "0")}.svg`, import.meta.url), art(i + 1, sizes[i % sizes.length], p));
});
console.log(`wrote ${PALETTES.length} sample artworks`);
