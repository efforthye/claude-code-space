# WHALE FARM

F2P 게임의 과금 설계자가 되어, 12주 안에 분기 목표 매출을 채우거나 해고당하는
**경제 로그라이트**. 프리미엄 유료($4.99), IAP 없음, 광고 없음, 오프라인 완결.

- 기획서: `wiki/services/whale-farm.md`
- 시장 근거: `wiki/concepts/paid-appstore-number-one-2026.md`
- 결정: `wiki/decisions/0021`, `0022`, `0023`

## 구조

```
sim/          경제 엔진 (TypeScript, 의존성 0, Node 24 네이티브 실행)
  rng.ts        시드 결정론 난수 — 데일리 챌린지와 몬테카를로의 전제
  types.ts      도메인 타입
  cards.ts      라이브옵스 카드 풀 (24종)
  engine.ts     주간 시뮬레이션 + 모든 밸런스 상수
  policies.ts   밸런싱용 AI 정책 (greedy / balanced / passive / random)
  montecarlo.ts 밸런싱 하네스 + 설계 명제 검증
tools/
  build-web.ts  sim/ → 브라우저 번들 → 자체완결 prototype.html
  smoke-ui.ts   DOM 스텁으로 프로토타입 런타임 검증
web/
  index.template.html  프로토타입 UI (소스)
  prototype.html       빌드 산출물 (자체완결, 폰에서 바로 플레이 가능)
assets/LICENSES.md     에셋 매니페스트 — 새 에셋은 반드시 여기 등록
```

**소스 단일화 원칙:** 프로토타입과 밸런싱 하네스는 `sim/`의 **같은 코드**를 돕니다.
밸런스 사본을 두 개 만들면 하루 안에 갈라집니다. `tools/build-web.ts`가 Node 내장
타입 스트리퍼로 번들을 만들기 때문에 외부 툴체인이 없습니다.

## 실행

```bash
node sim/montecarlo.ts 3000   # 밸런싱: 정책별 승률·파산율 + 설계 명제 검증
node tools/build-web.ts       # 번들 + prototype.html 생성 (스모크 테스트 포함)
node tools/smoke-ui.ts        # 프로토타입을 12주 완주시켜 런타임 오류 검출
open web/prototype.html       # 브라우저에서 플레이
```

## 밸런스의 판정 기준

`montecarlo.ts`는 이 게임의 설계 명제를 **실패 가능한 형태로** 검사합니다.
밸런스를 건드린 뒤 이 5개가 통과하지 않으면 밸런스가 틀린 것입니다.

1. 실력이 의미 있다 — `balanced`가 `random`을 15%p 이상 앞선다
2. 탐욕은 처벌된다 — `greedy` 승률 < `balanced` 승률
3. 탐욕은 유혹적이다 — `greedy` 평균 매출 > `balanced` 평균 매출
4. 착하기만 한 건 전략이 아니다 — `passive` 승률 < 25%
5. 풀리지 않았다 — `balanced` 승률이 30~75% 사이

2026-08-19 기준 실측: balanced 56.5% · random 38.9% · greedy 15.0%(파산 82.5%) · passive 1.4%.

## 상태

M0(종이 프로토타입) → **M1(헤드리스 코어) 완료** → **M2(플레이어블 1런) 완료(웹)** →
M3(Steam 데모) 준비 중. 출시 빌드 엔진은 Godot 4 (`0022`).
