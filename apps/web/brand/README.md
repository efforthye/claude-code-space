# MAYO mark

Two arches drawn as a lowercase "m" (a gallery doorway, a frame) and the period from "your object." on the aurora gradient (#6b3cff → #ff5fa2 → #ff9d4d). Pure vector, no font, so it holds at 16px.

- `mark-rounded.svg`: app icon with rounded corners (source of `src/app/icon.svg`, favicon, manifest 192/512)
- `mark-square.svg`: full-bleed square for iOS (`src/app/apple-icon.png`) and the maskable manifest icon; the OS rounds it

Regenerate after editing (needs `rsvg-convert` and ImageMagick):

```sh
cp brand/mark-rounded.svg src/app/icon.svg
rsvg-convert -w 180 -h 180 brand/mark-square.svg -o src/app/apple-icon.png
for s in 192 512; do rsvg-convert -w $s -h $s brand/mark-rounded.svg -o public/icons/icon-$s.png; done
rsvg-convert -w 512 -h 512 brand/mark-square.svg -o public/icons/icon-maskable-512.png
for s in 16 32 48; do rsvg-convert -w $s -h $s brand/mark-rounded.svg -o /tmp/fav-$s.png; done
magick /tmp/fav-16.png /tmp/fav-32.png /tmp/fav-48.png src/app/favicon.ico
```
