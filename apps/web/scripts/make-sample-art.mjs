// Generates abstract placeholder artworks for the dev sample catalogue.
// Shapes and palette echo the business-plan cover illustration. Run: node scripts/make-sample-art.mjs
import { writeFileSync } from "node:fs";

const palette = ["#1b2a55", "#c47a4e", "#e8e3d9", "#d7deec", "#8aa0c8", "#5a6380", "#f3efe6", "#2f5d50", "#b8463a"];
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];

function art(i, w, h) {
  const bg = pick(palette.slice(2));
  const parts = [`<rect width="${w}" height="${h}" fill="${bg}"/>`];
  parts.push(`<rect y="${h * (0.45 + rand() * 0.2)}" width="${w}" height="${h}" fill="${pick(palette.slice(3))}" opacity="0.8"/>`);
  for (let k = 0; k < 3 + (i % 3); k++) {
    const c = pick(palette);
    const x = rand() * w * 0.8, y = rand() * h * 0.8, s = (0.15 + rand() * 0.35) * Math.min(w, h);
    parts.push(
      rand() > 0.5
        ? `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s / 2}" fill="${c}" opacity="${0.75 + rand() * 0.25}"/>`
        : `<rect x="${x}" y="${y}" width="${s}" height="${s * (0.7 + rand())}" fill="${c}" opacity="${0.7 + rand() * 0.3}"/>`,
    );
  }
  if (i % 2 === 0) parts.push(`<line x1="${w * 0.55}" y1="${h * 0.1}" x2="${w * 0.9}" y2="${h * 0.85}" stroke="#1b2a55" stroke-width="${w / 90}"/>`);
  parts.push(`<path d="M0 ${h * 0.85} Q ${w * 0.3} ${h * 0.75} ${w * 0.6} ${h * 0.84} T ${w} ${h * 0.8} V ${h} H 0 Z" fill="#5a6380" opacity="0.85"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join("")}</svg>\n`;
}

const sizes = [[800, 660], [660, 800], [800, 800], [900, 600], [640, 860], [800, 700]];
for (let i = 1; i <= 14; i++) {
  const [w, h] = sizes[i % sizes.length];
  writeFileSync(new URL(`../public/samples/art-${String(i).padStart(2, "0")}.svg`, import.meta.url), art(i, w, h));
}
console.log("wrote 14 sample artworks");
