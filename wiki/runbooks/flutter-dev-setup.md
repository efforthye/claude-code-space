---
title: Flutter 개발 환경 세팅 (macOS)
type: runbook
tags: [flutter, dart, flame, android, ios, macos, setup]
created: 2026-08-28
updated: 2026-08-28
---

# Flutter 개발 환경 세팅 (macOS)

2026-08-28에 개발 맥북에서 실제로 수행한 절차. `flutter doctor` **전 항목 통과** + 4개 플랫폼
빌드 성공(Android APK · iOS 시뮬레이터 · macOS · Web)까지 확인된 구성입니다.

## 확정된 버전 조합

| 항목 | 버전 | 비고 |
|---|---|---|
| Flutter | **3.47.2** (stable) | `/opt/homebrew/share/flutter`, brew cask |
| Dart | 3.13.2 | Flutter 번들 |
| Flame | **1.38.2** | 요구사항 Flutter ≥ 3.41 |
| Gradle / AGP / Kotlin | **9.3.1 / 9.1.0 / 2.4.0** | Flutter 3.47 템플릿 기본값 |
| JDK | **OpenJDK 21.0.8** | Android Studio 번들 JBR. AGP 9는 JDK 17+ 필요 |
| Android Studio | 2025.1 (AI-251) | JBR 제공원 |
| Android SDK | platform 36, build-tools 36.1.0 / 36.0.0, NDK r28c | |
| **Android cmdline-tools** | **22.0** | ⚠️ 23.0 아님 — 아래 함정 참조 |
| Xcode | 16.4 (iOS SDK 18.5) | macOS 26.3에 비해 구버전. 26.6 업그레이드 가능 |
| iOS 시뮬레이터 런타임 | **iOS 18.6** | Xcode 16부터 별도 다운로드 (~7GB) |
| CocoaPods | 1.17.0 | brew 설치 (시스템 ruby 2.6으로 gem 설치 금지) |
| VS Code 확장 | Dart + **Flutter 3.140.0** | |

## 절차

```bash
brew install --cask flutter        # SDK + dart/flutter를 /opt/homebrew/bin에 링크
brew install cocoapods             # 시스템 ruby가 2.6이라 gem 대신 brew로

# SDK/JDK를 명시적으로 고정 — SDK가 두 벌 있어서 자동탐지에 맡기면 안 됨
flutter config --android-sdk "$HOME/Library/Android/sdk"
flutter config --jdk-dir "/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# cmdline-tools (기본 설치에 빠져 있음) — 22.0을 써야 함
sdkmanager --sdk_root="$HOME/Library/Android/sdk" "cmdline-tools;latest"
"$HOME/Library/Android/sdk/cmdline-tools/latest/bin/android" --no-metrics sdk install "cmdline-tools;22.0"
cd "$HOME/Library/Android/sdk/cmdline-tools" && mv latest 23.0 && ln -s 22.0 latest

yes | flutter doctor --android-licenses
xcodebuild -downloadPlatform iOS   # iOS 시뮬레이터 런타임 (~7GB, sudo 불필요)

code --install-extension dart-code.flutter
```

## 함정 3가지 (전부 실제로 걸렸음)

### 1. cmdline-tools 23.0은 Flutter와 맞지 않는다 ⚠️
`cmdline-tools;latest`를 설치하면 **23.0**이 오는데, 여기서 `sdkmanager`가 폐기되고 새 `android`
CLI로 대체됩니다. Flutter 3.47의 doctor는 아직 옛 방식으로 라이선스를 확인하므로
**`Android license status unknown`이 영원히 안 없어집니다.**
[flutter#191487](https://github.com/flutter/flutter/issues/191487) ·
[#191558](https://github.com/flutter/flutter/issues/191558)

**해법:** 22.0을 설치하고 `latest` 심볼릭 링크를 22.0으로 돌립니다(위 절차 참조).
23.0은 지우지 말고 남겨뒀다가, Flutter가 새 CLI를 지원하면 링크만 되돌리면 됩니다.

**부작용:** 안드로이드 빌드 때 `SDK XML version 4 was encountered` 경고가 뜹니다.
SDK 메타데이터가 22.0이 아는 것보다 최신이라서인데, **빌드는 정상 완료**됩니다. 무시해도 됩니다.

### 2. Android SDK가 두 벌 있다
- `~/Library/Android/sdk` — Android Studio용. 에뮬레이터·시스템 이미지·라이선스 보유
- `/opt/homebrew/share/android-commandlinetools` — brew cask

둘 중 하나로 통일해야 합니다. **Android Studio 쪽을 쓰고** `flutter config --android-sdk`로
못 박습니다. 그러지 않으면 라이선스는 A에 있는데 도구는 B를 보는 상황이 생깁니다.

### 3. iOS 시뮬레이터 런타임은 기본으로 안 깔린다
Xcode 16부터 시뮬레이터 런타임이 별도 다운로드입니다. 하나도 없으면:
- `flutter doctor` → `Unable to get list of installed Simulator runtimes`
- `flutter build ios --simulator` → **`No Xcode build settings have been found`**

두 번째 오류는 원인이 전혀 드러나지 않아 헤매기 쉽습니다. 원인은 시뮬레이터 대상이 0개라
`xcodebuild`가 빌드 설정을 만들지 못하는 것입니다. **런타임을 받으면 둘 다 해결됩니다.**

## 검증 (새 환경에서 이걸 통과하면 끝)

```bash
flutter doctor                                  # No issues found!
cd apps/flame_game
flutter analyze && flutter test
flutter build apk --debug                       # Gradle+JDK21+AGP 검증 (최초 ~190초)
flutter build macos --debug
flutter build ios --simulator --debug           # 시뮬레이터 런타임 검증
```

## 남은 것

- **Xcode 16.4 → 26.6** 업그레이드 가능(App Store 설치본, `mas upgrade 497799835`).
  Xcode 16.4의 SDK는 iOS 18.5 / macOS 15.5인데 OS는 macOS 26.3이라 어긋나 있습니다.
  지금 개발에는 지장 없지만 앱스토어 제출 요건을 맞추려면 언젠가 필요합니다.
- `.zshrc`에 `ANDROID_HOME`은 넣지 않았습니다(오너 요청). Flutter는 자체 설정으로 SDK를
  찾으므로 개발에 지장 없고, 터미널에서 `adb`·`emulator`를 직접 칠 때만 PATH가 필요합니다.

관련: [[flame-game]] _(게임 기획 확정 시 생성)_
