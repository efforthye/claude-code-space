# MAYO logo

The logo is a mark that stands in for the "m", followed by "ayo" in DM Serif Display (ink, or ivory on dark).
Two marks, chosen in admin (사이트 설정); stained glass is the default:

- `mark-glass.svg`: stained-glass m in a gold rim
- `mark-painting.svg`: a night landscape inside a gold-framed m

Both share one geometry (viewBox `2 13 104 77`, arches r=20, stroke 18), so they swap without layout shifts.
Next to text the mark has no background; only app icons sit on a tile.

Generated files (commit them; regenerate after editing a mark, needs `rsvg-convert` and ImageMagick):

- `icon-<mark>.svg`: square, transparent, for browser tabs → `public/brand/<mark>/icon.svg`
- `tile-<mark>.svg`, `tile-square-<mark>.svg`: ivory tile for app icons
- `public/brand/<mark>/{mark.svg, icon.svg, apple-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png}`
- `src/app/favicon.ico` (16/32/48, stained glass) for browsers without SVG favicons

```sh
for v in glass painting; do
  cp brand/mark-$v.svg public/brand/$v/mark.svg
  cp brand/icon-$v.svg public/brand/$v/icon.svg
  rsvg-convert -w 180 -h 180 brand/tile-square-$v.svg -o public/brand/$v/apple-icon.png
  rsvg-convert -w 192 -h 192 brand/tile-$v.svg -o public/brand/$v/icon-192.png
  rsvg-convert -w 512 -h 512 brand/tile-$v.svg -o public/brand/$v/icon-512.png
  rsvg-convert -w 512 -h 512 brand/tile-square-$v.svg -o public/brand/$v/icon-maskable-512.png
done
for s in 16 32 48; do rsvg-convert -w $s -h $s brand/icon-glass.svg -o /tmp/fav-$s.png; done
magick /tmp/fav-16.png /tmp/fav-32.png /tmp/fav-48.png src/app/favicon.ico
```

The icon and tile SVGs are built from the marks by wrapping them in a 512 frame (8px padding for tabs,
72px on a 116-radius tile for app icons, 80px full-bleed for iOS and maskable).
