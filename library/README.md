# Asset library — chosen, kept, not shipped

Assets the owner has picked out and wants to keep, but that no code uses yet.

Deliberately **outside every app's `assets/` folder**, so nothing here is
registered in a `pubspec.yaml` and none of it is bundled. An unused 700KB track
still costs every player the download, and a file that only exists in a
Downloads folder is a file that is gone in a month. This is the middle ground.

Some of this is earmarked for [`apps/flame_game`](../apps/flame_game) (말랑말랑팡팡)
and some for games that do not exist yet — the table says which.

## Using one

1. Copy it into the app's `assets/audio/` (that folder is registered by name, so
   a file at its top level needs no pubspec edit — a *subfolder* does).
2. Give it a role in `lib/core/game_audio.dart`. Nothing outside that file ever
   names an audio asset.
3. Add its row to the app's `assets/LICENSES.md`.

## audio/bgm/

| File | Original | Earmarked for |
| --- | --- | --- |
| `winter_village03.mp3` | `maou_game_village03.mp3` | 말랑말랑팡팡 — a winter map, if there is a seasonal update |
| `login_character_select_village01.mp3` | `maou_game_village01.mp3` | A future game — login / character select |
| `bar_lounge_town27.mp3` | `maou_game_town27.mp3` | A future game — a bar / lounge, unhurried and warm |

## images/

| File | Origin | Why it is here |
| --- | --- | --- |
| `btn_game_start_pressed.png` | Owner-drawn pressed variant of the GAME START button, cropped to the idle art's rect | The button now answers a press by swelling slightly and clicking, which reads better than a second drawing — and a 1MB image every player downloads to see for 200ms is a bad trade. Kept because it is hand-made and a future button may want it. `SpriteButton` still takes a `pressedSprite`, so putting it back is one argument. |

## Licence

All from **魔王魂 (maou.audio)**, composer 交一. Free for commercial use, no fee
and no registration, but **credit is required** (`음악: 魔王魂`) in any app that
ships one. Not CC0 — the music stays copyrighted. Redistributing or selling the
files themselves, uploading them to streaming services, feeding them to AI
training, or minting them are all forbidden; shipping one inside an app is not.

More tracks: <https://maou.audio/category/game/game-town/>. Direct downloads
follow `https://maou.audio/sound/game/maou_game_<name><NN>.mp3` with two-digit
numbers, and the server answers 403 to a bare `curl` — it wants a browser
User-Agent and `Referer: https://maou.audio/`.
