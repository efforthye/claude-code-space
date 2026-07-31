#!/usr/bin/env node
/**
 * Inject crawler-readable metadata into the exported web shell.
 *
 * WHY THIS EXISTS INSTEAD OF `app/+html.tsx`:
 * Expo Router only renders `+html.tsx` during STATIC rendering. This app is
 * exported with `web.output: "single"`, so `+html.tsx` is silently ignored —
 * the shell comes from Expo's default template. Switching to `output: "static"`
 * would enable it (and give per-route HTML, which is strictly better for SEO),
 * but static export still fails on this project:
 *
 *     TypeError: s.resetServerContext is not a function
 *     Error: Failed to statically export route: admin
 *
 * Re-tested and still reproducing on Expo SDK 54 / expo-router 6 (2026-07-31).
 * Until that is fixed, post-processing the one shell is the honest option.
 *
 * WHAT IT INJECTS AND WHY:
 * The exported shell carries 46 characters of body text. AI crawlers (GPTBot,
 * ClaudeBot, PerplexityBot, OAI-SearchBot) do not execute JavaScript at all, and
 * Googlebot renders JS only after a separate, much slower queue. Everything a
 * machine should know therefore has to be in the HTML as it leaves the server.
 *
 * Content rules — see wiki/concepts/ai-search-visibility.md:
 *  - Only claims that are TRUE and checkable. The GEO study (arXiv:2311.09735)
 *    measured that concrete detail (quotes +41%, statistics +31%, cited sources)
 *    raises citation rate while keyword stuffing does nothing.
 *  - The <noscript> body must be a SUBSET of what the app shows. Telling
 *    crawlers a different story than users is cloaking.
 *
 * Run: node scripts/seo-inject.mjs   (wired into `npm run build:web`)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'dist', 'index.html');

// The apex 307-redirects to www, so www is the URL that actually resolves and
// therefore the canonical one.
const SITE = 'https://www.mayo.im';
const TITLE = 'mayo — AI 장편 영상 생성 스튜디오';
const DESCRIPTION =
  '한 줄을 쓰면 AI가 시나리오와 씬으로 나누고, 클립을 만들어 하나의 영상으로 이어 붙입니다. ' +
  '10초 클립이 아니라 원하는 길이의 완성된 영상을 만들고, 완성본과 개별 클립을 함께 내려받습니다. ' +
  '웹과 iOS·Android에서 같은 프로젝트를 이어서 작업할 수 있습니다.';

const FEATURES = [
  ['요청한 길이의 장편 영상 생성', '시나리오 → 씬 분할 → 클립 생성 → 최종 편집본까지 자동으로'],
  ['이중 내보내기', '이어 붙인 완성본과 씬별 개별 클립을 함께'],
  ['화면 비율 5종', '16:9 유튜브, 9:16 숏츠·릴스, 1:1 정방형, 4:5 세로, 21:9 시네마 — 선택한 비율의 실제 해상도로 렌더링'],
  ['생성 모델 선택', '로컬 생성과 외부 유료 모델 중에서'],
  ['BYOK', '본인 API 키를 등록하면 그 키로 감독과 생성이 실행됩니다'],
  ['AI 감독', '대화하며 시나리오와 씬 프롬프트를 다듬습니다'],
  ['자막 편집', '한국어·일본어·중국어·라틴 문자를 감지해 맞는 무료 폰트를 자동 적용'],
  ['탐색과 공유', '피드에 게시하고, 로그인 없이 볼 수 있는 링크로 공유'],
];

// Question/answer pairs are the shape a generative engine can lift verbatim.
const FAQ = [
  [
    'mayo는 얼마나 긴 영상을 만들 수 있나요?',
    '길이를 지정하면 AI가 그 길이에 맞춰 시나리오를 짜고 씬으로 나눕니다. 대부분의 AI 영상 도구가 한 번에 10초 안팎의 클립만 만드는 것과 달리, mayo는 여러 클립을 생성해 하나의 영상으로 이어 붙입니다.',
  ],
  [
    '완성된 영상 말고 클립도 따로 받을 수 있나요?',
    '내보내기에 이어 붙인 완성본과 씬별 개별 클립이 함께 포함됩니다.',
  ],
  [
    '어떤 화면 비율을 지원하나요?',
    '16:9(유튜브), 9:16(숏츠·릴스), 1:1(정방형), 4:5(세로), 21:9(시네마) 5종을 지원하며 선택한 비율의 실제 해상도로 렌더링합니다.',
  ],
  [
    '본인 API 키를 쓸 수 있나요?',
    'BYOK를 지원합니다. 본인 키를 등록하면 그 키로 감독과 생성이 실행됩니다.',
  ],
  [
    '앱과 웹에서 같이 쓸 수 있나요?',
    '웹(mayo.im)과 iOS·Android 앱에서 같은 계정으로 이어서 작업합니다.',
  ],
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE}#app`,
      name: 'mayo',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'AI video generation',
      operatingSystem: 'Web, iOS, Android',
      url: SITE,
      description: DESCRIPTION,
      inLanguage: ['ko', 'en'],
      featureList: FEATURES.map(([name, detail]) => `${name} — ${detail}`),
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: '무료로 시작 — 가입 시 크레딧 지급',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}#website`,
      url: SITE,
      name: 'mayo',
      description: DESCRIPTION,
      inLanguage: 'ko',
      publisher: { '@id': `${SITE}#org` },
    },
    { '@type': 'Organization', '@id': `${SITE}#org`, name: 'mayo', url: SITE },
    {
      '@type': 'FAQPage',
      '@id': `${SITE}#faq`,
      mainEntity: FAQ.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEAD = `
    <meta name="description" content="${esc(DESCRIPTION)}" />
    <link rel="canonical" href="${SITE}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="mayo" />
    <meta property="og:title" content="${esc(TITLE)}" />
    <meta property="og:description" content="${esc(DESCRIPTION)}" />
    <meta property="og:url" content="${SITE}" />
    <meta property="og:locale" content="ko_KR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(TITLE)}" />
    <meta name="twitter:description" content="${esc(DESCRIPTION)}" />
    <script type="application/ld+json">${JSON.stringify(JSON_LD)}</script>
`;

const NOSCRIPT = `
    <noscript>
      <h1>${esc(TITLE)}</h1>
      <p>${esc(DESCRIPTION)}</p>
      <h2>무엇을 할 수 있나요</h2>
      <ul>
${FEATURES.map(([n, d]) => `        <li><strong>${esc(n)}</strong> — ${esc(d)}</li>`).join('\n')}
      </ul>
      <h2>자주 묻는 질문</h2>
${FAQ.map(([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`).join('\n')}
      <h2>어디서 쓰나요</h2>
      <p>웹 <a href="${SITE}">mayo.im</a> 과 iOS·Android 앱에서 같은 계정으로 작업합니다. 한국어와 영어를 지원합니다.</p>
    </noscript>
`;

// --- apply -----------------------------------------------------------------
if (!existsSync(HTML)) {
  console.error(`[seo-inject] ${HTML} not found — run \`expo export -p web\` first.`);
  process.exit(1);
}

let html = readFileSync(HTML, 'utf8');

if (html.includes('application/ld+json')) {
  console.log('[seo-inject] already injected — skipping.');
  process.exit(0);
}

const before = html.length;

// Korean content in a page declaring lang="en" is a real signal loss.
html = html.replace(/<html lang="en">/, '<html lang="ko">');
html = html.replace(/<title>.*?<\/title>/, `<title>${esc(TITLE)}</title>`);

if (!html.includes('</head>')) {
  console.error('[seo-inject] no </head> in the exported shell — Expo changed its template.');
  process.exit(1);
}
html = html.replace('</head>', `${HEAD}  </head>`);

if (!html.includes('<body>')) {
  console.error('[seo-inject] no <body> in the exported shell — Expo changed its template.');
  process.exit(1);
}
html = html.replace('<body>', `<body>${NOSCRIPT}`);

writeFileSync(HTML, html, 'utf8');

console.log(
  `[seo-inject] ok — ${before} -> ${html.length} bytes ` +
    `(+meta, +canonical, +og, +JSON-LD(${JSON_LD['@graph'].length} entities), +noscript, lang=ko)`
);
