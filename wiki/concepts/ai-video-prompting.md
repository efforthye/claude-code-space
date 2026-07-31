---
title: AI Video Prompting (Higgsfield / Seedance / Kling)
type: concept
tags: [mayo, generation, prompting, higgsfield]
created: 2026-07-22
updated: 2026-07-22
---

# AI Video Prompting — Higgsfield/Seedance/Kling 실전 규칙

Distilled from Higgsfield-ecosystem guides (community skill frameworks + the
official Seedance prompting guidance surfaced via search; higgsfield.ai blog
itself bot-blocks). Feeds the [[mayo]] director's prompt construction.

## MCSLA — 프롬프트 5층 구조 (모든 샷에 적용)

| 층 | 뜻 | 예 |
|---|---|---|
| Model | 모델 선택 | Kling 3.0 / Seedance 2.0 |
| Camera | 샷 타입 + 카메라 무브 | FPV drone through alley, slow dolly-in |
| Subject | 주인공/피사체 | woman in tactical jacket |
| Look | 스타일·색·무드·비율 | cinematic, cold blues, 16:9 |
| Action | 동작·내러티브 | sprinting, sliding under gate |

## Seedance 샷 구성 규칙

1. **샷 구조를 프롬프트 맨 위에 선언**: 샷 개수, 총 길이, 비율.
2. **샷을 번호 매겨 하나씩** 정확한 동작을 기술.
3. **에스컬레이션 아크**를 준다: calm → threat → transformation → aftermath.
4. "Intent over Precision" — 픽셀 디테일보다 의도/개념의 명확성이 결과를 좌우.

## 캐릭터 일관성 (여러 샷)

- **identity(누구인지)와 motion(어떻게 움직이는지)을 분리**해 기술.
- 캐릭터 시트(고정 외형 묘사문)를 만들어 모든 샷에 동일하게 반복 — mayo의
  ADR 0014 consistency 블록과 동일한 원리. Higgsfield는 Soul ID(사진으로
  캐릭터 학습)로 이를 제품화.

## Seedance 프롬프트 모드 (활용 패턴)

Reference-based(이미지 참조) · Continuation(앞 샷 이어가기) · Expand Shot
(화면 확장) · Edit Shot(기존 결과 수정) · Transformation(스타일 전환).

## Kling 3.0

- 캐릭터 중심 생성에 강함; 모션 프리셋이 카메라 컨트롤 명칭과 맞물림.
- 멀티샷 시퀀스에서도 identity/motion 분리가 핵심.

## mayo 적용 포인트

- 감독(planner)의 scene prompt 생성 시 MCSLA 순서로 필드를 배치.
- 씬 프롬프트 앞에 (비율·길이) 선언 + 샷 번호를 붙여 외부 모델에 전달.
- stylePrompt(=Look)와 characters(=Subject identity)는 이미 분리돼 있음 —
  motion만 씬별로 다르게 쓰도록 감독 시스템 프롬프트를 조정할 것.

Sources: OSideMedia/higgsfield-ai-prompt-skill (GitHub), Higgsfield Seedance
prompting guide (via search snapshot), Higgsfield Filmmaking MBA course
syllabus (Udemy listing).
