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

## Music — `audio/bgm_*.mp3`

**魔王魂 (maou.audio)**, composer 交一. Free for commercial use in a paid game,
no registration, no fee, no reporting — and **credit is required**. This is not
CC0: the music stays copyrighted, and the permission comes with that one string
attached.

The credit is rendered in the settings panel as `음악: 魔王魂`, because a credit
that only exists in this file is not a credit — it never reaches a player.

| File in this repo | Original | Used for |
| --- | --- | --- |
| `bgm_menu.mp3` | `maou_game_village04.mp3` | Main menu, from the end of the opening beat |
| `bgm_main.mp3` | `maou_game_village09.mp3` | A round in progress |
| `bgm_tense.mp3` | `maou_game_village08.mp3` | Held for a moment with something at stake |
| `bgm_fun.mp3` | `maou_game_village05.mp3` | Held for a draw / reward moment |

Download rule, for adding more: `https://maou.audio/sound/game/maou_game_<name><NN>.mp3`
(and `/sound/bgm/maou_bgm_<name><NN>.mp3`), two-digit numbers. The server answers
403 to a bare `curl` — it needs a browser User-Agent and `Referer: https://maou.audio/`.

**Forbidden** regardless of the above: redistributing or selling the audio files
themselves, uploading them to streaming platforms, feeding them to AI training,
minting them. Shipping them inside the app is none of those.

## Sound — `audio/`

All from **Kenney** (kenney.nl), released **CC0 / public domain**: no attribution
required, no restriction on commercial use. Downloaded from the official asset
pages; each pack's own `License.txt` ships in the download.

| File in this repo | Original | Pack | Used for |
| --- | --- | --- | --- |
| `ui_select.ogg` | `select_006.ogg` | Interface Sounds | Any button that emits `ButtonPressed` |
| `ui_click.ogg` | `click_003.ogg` | Interface Sounds | Small controls — gear, mute, sliders |
| `ui_ask.ogg` | `question_004.ogg` | Interface Sounds | A confirm dialog opening |
| `ui_confirm.ogg` | `confirmation_002.ogg` | Interface Sounds | The primary action in a modal |
| `ui_error.ogg` | `error_005.ogg` | Interface Sounds | A run lost (not a run quit) |
| `ui_switch.ogg` | `switch_007.ogg` | Interface Sounds | The 진동 toggle |
| `ui_tick.ogg` | `tick_001.ogg` | Interface Sounds | One notch of a volume slider |
| `ui_clear.ogg` | `confirmation_002.ogg` | Interface Sounds | A run cleared (same clip as the modal confirm, deliberately) |
| `ui_enter.ogg` | `maximize_006.ogg` | Interface Sounds | Moving forward into a scene |
| `ui_leave.ogg` | `minimize_006.ogg` | Interface Sounds | Coming back out of one |
| `ui_combo_0..7.wav` | `bong_001.ogg` | Interface Sounds | The combo ladder — one clip, re-rendered here a whole tone apart per step by resampling. Offline rather than at runtime because playback-rate APIs disagree across platforms about whether they move pitch at all |
| `impact/*.ogg` (130) | whole pack, unchanged names | Impact Sounds | `impactSoft_*` are the block pops; the rest are held for later |

CC0 asks for nothing, but crediting Kenney in the app's about screen is the
decent thing and costs a line.

## Character sprites — `images/character/`

**CraftPix** — "Free Tiny Schoolgirl Pixel Art Sprite Pack", the `Schoolgirl_2`
variant. Free licence: selling and distributing a game containing these assets
is permitted, and **no attribution is required** (credit is welcomed). Forbidden:
reselling the art source files, or shipping them in anything that lets a user
export the artwork itself. See <https://craftpix.net/file-licenses/>.

| File | Frames | Used for |
| --- | --- | --- |
| `schoolgirl_idle.png` | 4 | Standing still |
| `schoolgirl_walk.png` | 6 | Walking |
| `schoolgirl_hurt.png` | 2 | Held for a hit reaction |
| `schoolgirl_attack_1.png` | 5 | Held, unused |
| `schoolgirl_dead.png` | 2 | Held, unused |

**Modified from the original.** The pack ships 128×128 frames in which the
character occupies a 34×45 patch, off-centre — so she rendered tiny and 7px to
the left of wherever she was positioned. Every sheet is cropped here to one
shared 59×57 rect. Shared, because a per-sheet crop would make her jump the
moment the animation changed. The unmodified originals are in the owner's
download of the pack; they are not committed, since redistributing the source
art is exactly what the licence forbids.

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
