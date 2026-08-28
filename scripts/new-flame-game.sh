#!/usr/bin/env bash
#
# Scaffold a new Flutter + Flame game from templates/flame-game.
#
#   scripts/new-flame-game.sh <slug> [--org com.example] [--title "Display Name"]
#
# Why a script instead of `cp -R apps/flame_game apps/new_game`:
#   - a Flutter project's name is baked into pubspec, the iOS/Android bundle ids,
#     the Xcode project and the .iml file. Copying leaves the old name in all of them.
#   - the ios/, android/ and macos/ folders age. `flutter create` regenerates them
#     for whatever Flutter and Xcode are installed today, so a project scaffolded a
#     year from now gets a current platform shell rather than an inherited stale one.
#
# The template's lib/ uses only relative imports, so the architecture itself needs
# no renaming — it grafts on untouched. Only the tests reference the package name.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO_ROOT/templates/flame-game"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
step() { printf '\n\033[36m==>\033[0m %s\n' "$*"; }

SLUG=""
ORG="com.efforthye"
TITLE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --org)   ORG="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*) die "unknown option: $1" ;;
    *)  [ -z "$SLUG" ] || die "unexpected argument: $1"; SLUG="$1"; shift ;;
  esac
done

[ -n "$SLUG" ] || die "usage: scripts/new-flame-game.sh <slug> [--org com.example] [--title \"Name\"]"

# Dart package names: lowercase letters, digits, underscores; must not start with a digit.
printf '%s' "$SLUG" | grep -Eq '^[a-z][a-z0-9_]*$' \
  || die "slug must be lower_snake_case (Dart package rules), got: $SLUG"

command -v flutter >/dev/null || die "flutter not on PATH"
[ -d "$TEMPLATE/lib" ] || die "template missing at $TEMPLATE"

DEST="$REPO_ROOT/apps/$SLUG"
[ ! -e "$DEST" ] || die "apps/$SLUG already exists"

step "flutter create — fresh platform shell for the installed toolchain"
flutter create --org "$ORG" --project-name "$SLUG" \
  --platforms=ios,android,macos "$DEST" >/dev/null
printf '    apps/%s created (org %s)\n' "$SLUG" "$ORG"

step "grafting the architecture on"
rm -rf "$DEST/lib" "$DEST/test"
cp -R "$TEMPLATE/lib" "$DEST/lib"
mkdir -p "$DEST/test"
cp "$TEMPLATE/test/architecture_test.dart" "$DEST/test/architecture_test.dart"
cp -R "$TEMPLATE/assets" "$DEST/assets"
# Tests import through the package name; lib/ uses relative imports and needs none.
if [ "$(uname)" = "Darwin" ]; then
  sed -i '' "s|package:flame_game/|package:$SLUG/|g" "$DEST/test/architecture_test.dart"
else
  sed -i "s|package:flame_game/|package:$SLUG/|g" "$DEST/test/architecture_test.dart"
fi
printf '    lib/ (%s files) + test/ + assets/\n' "$(find "$DEST/lib" -name '*.dart' | wc -l | tr -d ' ')"

step "dependencies"
( cd "$DEST" && flutter pub add flame >/dev/null && flutter pub add dev:flame_test >/dev/null )
printf '    flame + flame_test\n'

step "pubspec assets + analyzer rules"
python3 - "$DEST" "$TEMPLATE" <<'PY'
import pathlib, re, sys

dest, template = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])

pub = dest / 'pubspec.yaml'
s = pub.read_text()
block = (
    "  # Asset roots. Flame reads sprites from assets/images/ and audio from\n"
    "  # assets/audio/, so these folder names are its convention. Registered by\n"
    "  # folder, so adding art later needs no pubspec edit.\n"
    "  assets:\n"
    "    - assets/images/\n"
    "    - assets/audio/\n"
    "    - assets/data/\n"
)
if re.search(r'^  assets:', s, re.M):
    print('    assets block already present, left alone')
else:
    # `flutter create` leaves the block commented out; replace it in place so the
    # entry lands under `flutter:` at the right indentation.
    commented = re.compile(
        r'  # To add assets to your application, add an assets section, like this:\n'
        r'(?:  #.*\n)+'
    )
    if commented.search(s):
        s = commented.sub(block, s, count=1)
    else:
        s = re.sub(r'^  uses-material-design: true\n', '  uses-material-design: true\n\n' + block, s, count=1, flags=re.M)
    pub.write_text(s)
    print('    assets registered')

opts = dest / 'analysis_options.yaml'
o = opts.read_text()
entry = (
    "    # Fields are private with public constructor parameters on purpose:\n"
    "    # state is encapsulated behind getters, and `this._velocity` as a formal\n"
    "    # would leak underscore names into every component's public API.\n"
    "    prefer_initializing_formals: false\n"
)
if 'prefer_initializing_formals' in o:
    print('    analyzer rule already present')
elif re.search(r'^  rules:\s*$', o, re.M):
    # `flutter create` ships an empty `rules:` under `linter:`. Adding another one
    # is a duplicate mapping key, which makes the whole file unparseable.
    o = re.sub(r'^  rules:\s*\n', '  rules:\n' + entry, o, count=1, flags=re.M)
    opts.write_text(o)
    print('    analyzer rule added under existing rules:')
elif re.search(r'^linter:\s*$', o, re.M):
    o = re.sub(r'^linter:\s*\n', 'linter:\n  rules:\n' + entry, o, count=1, flags=re.M)
    opts.write_text(o)
    print('    analyzer rule added with new rules:')
else:
    opts.write_text(o.rstrip() + '\n\nlinter:\n  rules:\n' + entry)
    print('    linter section appended')
PY

if [ -n "$TITLE" ]; then
  step "display name"
  python3 - "$DEST" "$TITLE" <<'PY'
import pathlib, re, sys
dest, title = pathlib.Path(sys.argv[1]), sys.argv[2]
plist = dest / 'ios/Runner/Info.plist'
if plist.exists():
    s = plist.read_text()
    s = re.sub(r'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)', r'\1' + title + r'\2', s)
    plist.write_text(s)
manifest = dest / 'android/app/src/main/AndroidManifest.xml'
if manifest.exists():
    s = manifest.read_text()
    s = re.sub(r'android:label="[^"]*"', f'android:label="{title}"', s, count=1)
    manifest.write_text(s)
print(f'    set to "{title}"')
PY
fi

step "verifying"
( cd "$DEST" && flutter analyze && flutter test )

cat <<EOF

$(printf '\033[32mdone\033[0m') — apps/$SLUG

  cd apps/$SLUG && flutter run

  Flow: TITLE -> MAIN MENU -> GAME -> GAME END, every hop a SceneRequested event.
  The tap-to-score demo in lib/scenes/game_scene.dart and lib/systems/ is a
  placeholder: replace those systems with the real game, leave core/ alone.

  Art: drop a PNG in assets/images/, then Sprite.load('name.png').
  See templates/flame-game/README.md for the tour.
EOF
