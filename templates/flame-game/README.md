# Flame 게임 템플릿

새 Flutter + Flame 게임의 출발점. `apps/flame_game`에서 실제로 돌려보며 다듬은 구조를
재사용 가능한 형태로 떼어낸 것입니다.

## 쓰는 법

```bash
scripts/new-flame-game.sh my_game --title "My Game"
cd apps/my_game && flutter run
```

슬러그는 **lower_snake_case**여야 합니다 (Dart 패키지 이름 규칙). `--org`로 번들 ID 접두사를
바꿀 수 있습니다(기본 `com.efforthye`).

### 왜 복사가 아니라 스크립트인가

Flutter 프로젝트 이름은 `pubspec`·iOS/Android 번들 ID·Xcode 프로젝트·`.iml`에 박혀 있어서
`cp -R` 하면 옛 이름이 곳곳에 남습니다. 그리고 `ios/`·`android/`·`macos/` 폴더는 **낡습니다** —
1년 뒤에 복사하면 그 시점의 Xcode와 안 맞는 껍데기를 물려받게 됩니다.

그래서 스크립트는 `flutter create`로 **설치된 툴체인에 맞는 새 플랫폼 껍데기**를 만들고,
그 위에 아키텍처만 얹습니다. 템플릿의 `lib/`는 **상대 경로 import만** 쓰므로 패키지 이름과
무관하게 그대로 이식됩니다. 패키지 이름을 참조하는 건 테스트 파일 하나뿐이고 스크립트가 치환합니다.

## 구조

```
lib/
  core/         프레임. 게임 로직 없음 — 여기는 웬만하면 건드리지 않습니다
    design       고정 가상 해상도(720×1280). 모든 좌표의 기준
    game_frame   버스·세션·씬매니저만 소유하는 껍데기
    event_bus    타입별 구독 on<T>(), 자동 해지 EventSubscriber 믹스인
    events       sealed GameEvent + 이벤트 카탈로그 ← 새 이벤트는 여기 추가
    scene        Scene 인터페이스 + SceneComponent 템플릿 메서드 베이스
    scene_manager 씬 팩토리 테이블 · 전환 · "지금 어느 씬인가"의 단일 진실
    game_session  씬보다 오래 사는 상태(점수·최고기록·런 횟수)
  scenes/       title · main_menu · game · game_end  ← 갈아끼우는 곳
  systems/      GameSystem 인터페이스 + 예시 구현  ← 게임 규칙이 사는 곳
  ui/           button · debug_overlay · title_art(스프라이트+이펙트 참고용)
  world/        background(3종) · GameObject/Actor/Damageable
assets/
  images/       Sprite.load('name.png') 가 여기서 찾습니다
  audio/        FlameAudio 가 여기서 찾습니다
  fonts/ data/  준비만 해둔 자리
```

## 새 게임을 만들 때 어디를 건드리나

| 하고 싶은 것 | 건드릴 곳 |
|---|---|
| 게임 규칙 | `lib/systems/` 에 `GameSystem` 구현 추가 → `GameScene`이 알아서 돌립니다 |
| 새 화면 | `lib/scenes/` 에 `SceneComponent` 추가 + `SceneId`에 값 추가 + `GameFrame`의 팩토리 테이블에 한 줄 |
| 새 이벤트 | `lib/core/events.dart` 에만 추가 (sealed이라 한 파일에 모여야 합니다) |
| 화면 비율/해상도 | `lib/core/design.dart` 상수 두 개 |
| 아트 | `assets/images/`에 PNG 넣고 `Sprite.load('name.png')` — pubspec 수정 불필요 |

**`core/`는 손대지 않는 것이 기본값입니다.** 게임마다 달라지는 것은 씬·시스템·아트이지
프레임이 아닙니다.

## 지켜진 규칙들 (깨지 마세요)

- **씬끼리 서로를 참조하지 않습니다.** 이동은 `goTo(SceneId.x)` → `SceneRequested` 이벤트로만.
  누가 처리할지는 씬이 알 바 아닙니다.
- **구독 해지를 씬이 관리하지 않습니다.** `listen<T>()`으로 등록하면 `SceneComponent`가
  제거 시 자동 취소합니다. 잊을 수가 없는 구조입니다.
- **좌표는 언제나 `sceneSize`(디자인 공간)** 입니다. 실기기 크기(`game.size`)를 쓰면
  기기 비율이 바뀔 때 레이아웃이 무너집니다. 카메라가 레터박스를 처리합니다.
- **애니메이션은 `update()`의 sin 계산이 아니라 Flame 이펙트**로. 이펙트는 조합되고,
  자기 컨트롤러를 갖고, 런타임에 붙였다 뗄 수 있습니다. `ui/title_art.dart`가 참고 구현입니다.
- **버스는 비동기 전달**입니다(broadcast stream). 동기 버스는 핸들러가 순회 중에 emit해서
  재진입 버그를 만듭니다. 전환이 한 프레임 늦는 건 60fps에서 안 보입니다.

## 삭제해도 되는 것 (데모)

`lib/scenes/game_scene.dart`의 탭-투-스코어 데모와 `lib/systems/`의 `ScoreSystem`·`SpawnSystem`,
`lib/world/game_object.dart`의 `Actor`는 **구조가 실제로 도는지 보여주기 위한 자리**입니다.
진짜 게임 규칙이 정해지면 갈아끼우세요. `core/`·`ui/button`·`world/background`는 남깁니다.

## 검증

스캐폴딩 직후 `flutter analyze`와 `flutter test`가 통과해야 정상입니다. 테스트는 아키텍처의
계약을 검사합니다 — 이벤트 타입 필터링, 구독 해지, 세션 유지, 씬 전환, 중복 요청 무시.

세부 배경과 겪은 함정은 `wiki/concepts/flame-game-template.md`와
`wiki/runbooks/flutter-dev-setup.md`에 있습니다.
