---
title: AI 검색 가시성 (GEO) + 전통 SEO
type: concept
tags: [concept, seo, geo, ai-search, llm, web, mayo]
created: 2026-07-31
updated: 2026-07-31
---

# AI 검색 가시성 (GEO) + 전통 SEO

ChatGPT·Claude·Perplexity·Google AI Overviews가 답을 합성할 때 무엇을 인용하는가,
그리고 그 앞단에서 전통 검색엔진이 페이지를 어떻게 읽는가. [[mayo]]의 웹
([[mayo-web-target]])에 적용한 근거를 여기 모읍니다.

논문 원문은 `raw/assets/2311.09735-geo-generative-engine-optimization.pdf`.

---

## 1. 무엇이 실제로 인용을 늘리는가 — 측정된 것만

**GEO: Generative Engine Optimization** (Aggarwal 외, Princeton·IIT Delhi, KDD 2024,
[arXiv:2311.09735](https://arxiv.org/abs/2311.09735)) 이 9가지 기법을 GEO-bench에서
측정했습니다. 결과가 직관과 다릅니다:

| 기법 | Position-Adjusted Word Count | Subjective Impression |
|---|---|---|
| **인용문 추가** (Quotation Addition) | **+41%** | **+28%** |
| **통계 수치 추가** (Statistics Addition) | +31% | +23% |
| **출처 명시** (Cite Sources) | 위 둘에 근접 | 위 둘에 근접 |
| 키워드 스터핑 | 효과 없음 | 효과 없음 |

전체적으로 **가시성 최대 40% 향상**. 유창성 개선 + 통계 추가를 **조합**하면 단일 기법
최고치보다 5.5% 더 높았습니다.

**해석.** 생성 엔진은 새로운 정보가 아니라 **집어 갈 수 있는 단위**에 반응합니다.
이름이 붙은 인용문, 구체적인 숫자, 검증 가능한 출처는 모델이 답변에 그대로 끼워
넣을 수 있는 조각입니다. 반대로 "업계 최고", "가장 뛰어난" 같은 자기 서술은 검증
불가능해서 무시됩니다.

> **mayo에 주는 함의:** "AI에게 우리가 최고라고 검색되게" 하는 방법은 최고라고 쓰는
> 게 아니라, **확인 가능한 사실을 주는 것**입니다. "화면 비율 5종을 실제 해상도로
> 렌더링", "완성본과 씬별 클립을 함께 내보내기" 같은 문장은 모델이 인용할 수 있고,
> "최고의 AI 영상 도구"는 인용할 수 없습니다.

전자상거래 도메인 확장판으로 **E-GEO** ([arXiv:2511.20867](https://arxiv.org/abs/2511.20867),
Amazon 리스팅 13,747 쿼리 테스트베드)가 있습니다 — 상품 페이지에 같은 원리를 적용할 때 참고.

## 2. 그 전에 — 크롤러가 페이지를 읽기는 하는가

GEO 기법은 **내용이 읽힌다는 전제** 위에서만 의미가 있습니다. 자바스크립트로
렌더링되는 SPA는 그 전제가 깨집니다.

- **Googlebot**은 JS를 실행하지만 **렌더 큐가 따로** 돌아갑니다. 최초 fetch와 렌더
  사이에 수 시간~수 주가 걸리고, 크롤된 URL 중 일부만 큐에 들어갑니다. JS 의존
  링크는 처리까지 최대 300시간대, 순수 HTML 링크는 30시간대라는 관측이 있습니다.
- **AI 크롤러(GPTBot·ClaudeBot·PerplexityBot·OAI-SearchBot)는 JS를 아예 실행하지
  않습니다.** 이들에게 SPA는 빈 페이지입니다. 2026 기준 AI 엔진의 렌더링 능력은
  Google의 WRS보다도 낮습니다.

**mayo 실측 (2026-07-31).** `www.mayo.im`이 모든 크롤러에게 동일하게 반환한 것:

| 항목 | 값 |
|---|---|
| HTML 총 길이 | 1,210 바이트 |
| 본문 가시 텍스트 | **46자** |
| meta description · JSON-LD · og:* · canonical | 전부 없음 |
| robots.txt · llms.txt · sitemap.xml | 전부 404 |
| GPTBot / ClaudeBot / PerplexityBot이 받는 양 | Googlebot과 동일 (46자) |

`vercel.json`에 서버 렌더 OG 우회가 있었지만 **`/reel/:id` 한 경로에만**, 그리고
UA 목록에 AI 크롤러가 **하나도 없었습니다.**

## 3. mayo에 적용한 것

| 조치 | 파일 | 근거 |
|---|---|---|
| HTML 셸에 title·description·canonical·OG·Twitter 카드 | `src/app/+html.tsx` | 크롤러가 JS 없이 읽는 유일한 지점 |
| JSON-LD — SoftwareApplication·WebSite·Organization·**FAQPage** | 같은 파일 | 엔티티를 추론이 아니라 **검증**하게 함. Q&A는 생성 엔진이 통째로 인용하기 좋은 형태 |
| `<noscript>` 본문 — 실제 기능 목록과 설명 | 같은 파일 | JS 미실행 파서가 읽는 내용. 앱이 보여주는 것과 **같은 사실**이어야 함 (다른 이야기를 하면 클로킹) |
| `robots.txt` — AI 크롤러 19종 명시적 Allow | `public/robots.txt` | `Google-Extended`·`Applebot-Extended`는 **규칙이 없으면 제외**로 해석. 침묵은 동의가 아님 |
| `llms.txt` | `public/llms.txt` | 채택률은 아직 부분적 — 대부분의 AI 크롤러는 여전히 HTML을 직접 긁습니다. 비용이 거의 없어서 넣었을 뿐, 이것만으로는 아무 일도 일어나지 않습니다 |
| `sitemap.xml` | `public/sitemap.xml` | 정적 경로만. 게시된 릴은 동적이라 API 생성 사이트맵 필요 (미완) |
| AI 크롤러 UA를 리얼 OG 우회에 추가 | `vercel.json` | GPTBot·ClaudeBot·PerplexityBot·OAI-SearchBot 등 20종 추가 |

**canonical은 `https://www.mayo.im`** — apex `mayo.im`이 www로 307 리다이렉트하므로,
실제로 응답하는 호스트를 정본으로 잡아야 합니다.

## 4. 아직 안 된 것 (정직하게)

- **랜딩 외 경로는 여전히 같은 메타를 씁니다.** `web.output: "single"`이라 HTML 셸이
  하나뿐입니다. `/reels`, `/plan`이 홈과 동일한 title·description을 갖습니다.
  경로별 메타가 필요하면 `output: "static"`으로 프리렌더하거나
  ([[mayo-web-target]]에 기록된 `resetServerContext` 이슈를 먼저 해결해야 함), 리얼
  페이지처럼 API에서 서버 렌더 HTML을 주는 방식으로 가야 합니다.
- **`<noscript>`는 차선책입니다.** Google은 이를 읽지만 가중치를 낮게 볼 수 있고,
  진짜 해법은 프리렌더/SSR입니다. 지금은 "빈 페이지보다 낫다"의 단계입니다.
- **다국어 미대응.** 현재 `lang="ko"` 고정, hreflang 없음. 한국어권 밖에서는 이
  자체가 가시성 상한입니다.
- **게시된 릴의 동적 사이트맵 없음.**
- **측정 수단 없음.** AI 엔진이 실제로 mayo를 인용하는지 추적하는 장치가 없습니다.
  Search Console 등록도 안 돼 있습니다.

## 5. 원칙 — 이 페이지를 고칠 때

1. **사실만 쓴다.** llms.txt와 JSON-LD와 noscript가 서로, 그리고 앱과 일치해야
   합니다. 기능이 바뀌면 세 곳을 같이 고칩니다. 사실과 다른 구조화 데이터는 신뢰를
   잃는 가장 빠른 길이고, 검색엔진에게는 스팸 신호입니다.
2. **최상급 대신 수치.** 논문이 말하는 그대로입니다.
3. **크롤러에게만 다른 내용을 보이지 않는다.** noscript와 서버 렌더 HTML은 앱이
   보여주는 것의 **부분집합**이어야 합니다.

## Related
- 웹 빌드 구조: [[mayo-web-target]] · 서비스: [[mayo]]
- 논문 PDF: `raw/assets/2311.09735-geo-generative-engine-optimization.pdf`
