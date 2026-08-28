---
title: Flutter 개발 환경 세팅 (macOS)
type: runbook
tags: [flutter, dart, flame, android, ios, macos, setup]
created: 2026-08-28
updated: 2026-08-29
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
| Xcode | **26.6** (Build 17F113) | iOS SDK 26.5 / macOS SDK 26.5 |
| iOS 플랫폼 지원 | **iOS 26.5 필수** | Xcode 26은 자기 세대 플랫폼이 없으면 빌드 대상이 0개 (~9GB) |
| iOS 시뮬레이터 런타임 | iOS 26.5 + 18.6 | 런타임은 Xcode.app과 별도 저장소라 Xcode 교체에도 살아남음 |
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
xcodebuild -downloadPlatform iOS   # iOS 플랫폼 + 시뮬레이터 런타임 (~9GB, sudo 불필요)

code --install-extension dart-code.flutter
```

## 함정 4가지 (전부 실제로 걸렸음)

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

### 4. Xcode 메이저 업그레이드 뒤에는 툴체인 전체가 잠긴다 ⚠️

2026-08-28에 Xcode 16.4 → 26.6(App Store 설치본, `mas upgrade 497799835`, ~15GB)을 올린 뒤
겪은 것. **설치는 성공했는데 모든 것이 실패한 것처럼 보입니다:**

```
xcodebuild -checkFirstLaunchStatus  → exit 69
xcodebuild -showsdks               → 빈 출력
xcrun simctl list runtimes         → 빈 출력
pod --version                      → "You have not agreed to the Xcode license"
```

원인은 **라이선스 미동의 하나**입니다. 이게 막히면 SDK 조회·시뮬레이터·CocoaPods가 전부
빈 출력을 내서 설치 실패로 오인하기 쉽습니다. **sudo가 필요하므로 사람이 직접 해야 합니다:**

```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

이어서 두 번째 함정: 라이선스를 풀어도 **iOS 빌드가 계속 실패**합니다.
`xcodebuild -showsdks`는 iOS 26.5를 보여주지만 그건 SDK 헤더일 뿐이고, 플랫폼 지원은 별도입니다.

```bash
cd ios && xcodebuild -project Runner.xcodeproj -scheme Runner -showdestinations
#   Available destinations: (없음)
#   Ineligible: error: iOS 26.5 is not installed.
```

**구세대 런타임(18.6)을 갖고 있어도 소용없습니다** — Xcode 26은 자기 세대 플랫폼을 요구합니다.
`xcodebuild -downloadPlatform iOS`(~9GB)로 받으면 풀립니다.

> **진단 요령:** iOS 빌드가 `No Xcode build settings have been found`로 죽으면 로그를 뒤지지 말고
> 위 `-showdestinations`를 먼저 치세요. 원인을 한 줄로 말해줍니다.

**업그레이드 결과:** 프로젝트 코드는 **한 줄도 고칠 필요가 없었습니다.** macOS SDK가
15.5 → 26.5로 한 세대 점프했는데도 빌드가 그대로 통과했습니다.

## 검증 (새 환경에서 이걸 통과하면 끝)

```bash
flutter doctor                                  # No issues found!
cd apps/flame_game
flutter analyze && flutter test
flutter build apk --debug                       # Gradle+JDK21+AGP 검증 (최초 ~190초)
flutter build macos --debug
flutter build ios --simulator --debug           # iOS 플랫폼/런타임 검증
```

2026-08-29 실측: 4개 타깃 전부 통과 (Xcode 26.6 · iOS SDK 26.5 · macOS SDK 26.5).

## 남은 것

- `.zshrc`에 `ANDROID_HOME`은 넣지 않았습니다(오너 요청). Flutter는 자체 설정으로 SDK를
  찾으므로 개발에 지장 없고, 터미널에서 `adb`·`emulator`를 직접 칠 때만 PATH가 필요합니다.
- `docker-desktop` cask 업그레이드는 sudo가 필요해 자동화하지 못했습니다(`brew upgrade --cask
  docker-desktop`을 사람이 실행). 나머지 brew formulae 90개는 무인 업그레이드에 성공했고,
  `mayo-api`의 `.venv`(brew python@3.14 기반)도 3.14.4 → 3.14.7 업그레이드 후 정상 동작합니다.

관련: [[flame-game]] _(게임 기획 확정 시 생성)_
