# Third-party assets — 말랑말랑팡팡

Every bundled asset and where the right to ship it comes from. Update this file
in the same commit that adds or removes an asset.

## Fonts

### 온글잎 은별 — `fonts/Ownglyph-Eunbyul.ttf`
- Registered in `pubspec.yaml` as family **`Eunbyul`**. Body copy.
- Source: 눈누 (noonnu.cc), 온글잎 (Ownglyph) 프로젝트.
- Terms as published on the 눈누 licence table, confirmed by the owner
  (2026-08-29): 인쇄·웹사이트·영상·포장지·임베딩·BI/CI·OFL **모두 사용 가능**.
- **임베딩 사용 가능** is the clause this app relies on: the `.ttf` ships inside
  the iOS/Android bundle as part of the application binary.
- **Not permitted:** redistributing the font file itself as a font file, or
  selling it. Shipping it inside the app is not redistribution; publishing it to
  a CDN, an asset pack, or a public download would be.

### 온글잎 데이지 — `fonts/Ownglyph-Daisy.ttf`
- Registered in `pubspec.yaml` as family **`Daisy`**. Headings and result copy.
- Same source and same terms as 은별 above.

**Why the files are bundled rather than linked.** 눈누 also publishes a jsDelivr
`@font-face` webfont for these faces. That is a browser mechanism with no Flutter
equivalent, and a network-fetched font would leave the first launch showing a
fallback face and would fail outright offline — which this game is meant to be.
Bundling is both the correct engineering choice and the licensed one.

## Images — `images/`

| File | Use | Origin |
| --- | --- | --- |
| `logo.png` | Wordmark on the main menu | Commissioned/generated for this project by the owner |
| `bg_main_menu.png` | Main menu backdrop | Commissioned/generated for this project by the owner |
| `btn_game_start.png` | GAME START button, idle | Commissioned/generated for this project by the owner |
| `btn_game_start_pressed.png` | GAME START button, pressed | Owner-supplied variant, cropped here to the idle art's rect so the two frames align to the pixel |
| `app_icon_source.png` | Source for the generated iOS/Android icon sets | Commissioned/generated for this project by the owner |

These are the project's own artwork. If any of them is later replaced with a
stock or marketplace asset, record the marketplace, the licence tier, and the
purchase reference in this table before committing it.
