// Wire types for the mayo-api backend. These mirror the FastAPI schemas in
// apps/mayo-api/app/schemas.py exactly.

export type JobStatus = 'queued' | 'generating' | 'done' | 'failed';
export type Visibility = 'private' | 'unlisted' | 'public';
export type ModelKind = 'image' | 'video';

export type Tier = { id: string; label: string; blurb: string; pricePerMin: number };
export type Duration = { id: string; label: string; seconds: number };
export type Plan = { id: string; monthly: number; storageMb?: number; monthlyCredits?: number };
// One-time credit pack — purchasable WITHOUT a subscription (ADR 0017 v2).
export type CreditPack = { id: string; credits: number; usd: number };
export type RetentionPlan = { id: string; days: number; credits: number };
export type ModelProvider = { id: string; name: string; kind: ModelKind; tier: string; blurb: string };
// AI director ("screenwriter") model — a Claude model id, e.g. "claude-opus-4-8".
export type DirectorModel = { id: string; name: string; tier: string; blurb: string };
// AI director backend: offline stub | free local LLM | paid Claude.
export type PlannerBackend = 'mock' | 'local' | 'claude';

export type Job = {
  id: string;
  title: string;
  status: JobStatus;
  scenesDone: number;
  scenesTotal: number;
  etaMin?: number | null;
  tierLabel?: string | null;
  seconds?: number | null;
  sceneUrls?: string[] | null; // clips rendered so far (live preview)
  // Per-scene prompts (legacy/quick path) — shown on the progress screen.
  scenePrompts?: string[] | null;
  // Consistency block (style + character sheet) prepended to every scene render.
  stylePrompt?: string | null;
  // Credits charged at create — cancelling refunds the unrendered share.
  chargedCredits?: number | null;
  /** Which gate this job waits at. Legacy jobs stay at 'clips' (ADR 0020). */
  stage?: JobStage;
  /** Timecoded breakdown. Empty for legacy jobs, which use scenePrompts. */
  segments?: Segment[];
};

export type Video = {
  id: string;
  title: string;
  durationLabel: string;
  sizeLabel: string;
  expiresInDays: number;
  accent: string;
  resolution: string;
  tierLabel: string;
  scenes: number;
  createdLabel: string;
  // Playback path of the stitched film (relative to the API base), when a real
  // backend produced one; null/absent for mock/metadata-only videos.
  url?: string | null;
  youtubeUrl?: string | null;
  // Generation recipe — lets the AI director load and revise this film.
  prompt?: string | null;
  scenePrompts?: string[] | null;
  stylePrompt?: string | null;
};

export type Storage = {
  usedLabel: string;
  totalLabel: string;
  usedRatio: number;
  usedBytes?: number;
};
export type Estimate = {
  seconds: number;
  tier: string;
  /** What a subscriber spends. */
  credits: number;
  /** Pay-as-you-go price for exactly this render, in USD. Banded by length. */
  usd: number;
  scenes: number;
  /** Measured wall-clock estimate, allowing for the provider's 4-at-a-time cap. */
  etaSeconds: number;
};
export type Health = { status: string; env: string; storage: string };

// Output aspect ratio — the film really renders at this shape.
export type Aspect = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';
/** Furthest point a segment has reached. Linear: a gate asks "at least X". */
export type SegmentStatus =
  | 'draft'
  | 'approved'
  | 'imaged'
  | 'imageApproved'
  | 'rendered'
  | 'clipApproved';

export type JobStage = 'beats' | 'stills' | 'clips' | 'done';

/** One timecoded slice — the unit of review and of billing (ADR 0020). */
export type Segment = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  prompt: string;
  status: SegmentStatus;
  imageKey?: string | null;
  clipKey?: string | null;
  rewrites: number;
  imageRuns: number;
  clipRuns: number;
};

export type CreateJobRequest = {
  prompt: string;
  seconds: number;
  tier: string;
  scenePrompts?: string[];
  // Style + character-sheet block repeated into every scene render so recurring
  // characters keep the same look across independently generated clips.
  stylePrompt?: string;
  aspect?: Aspect;
  /** Cinematic variant id from the catalog, e.g. 'dop-lite'. */
  videoModel?: string;
  /** Start in the review-gated flow (ADR 0020). Not charged at creation. */
  staged?: boolean;
};
export type RuntimeSettings = {
  generationBackend: string;
  plannerBackend?: PlannerBackend;
  directorModel?: string;
  byok?: boolean;
};

export type TextPosition = 'top' | 'center' | 'bottom';
export type ClipFilter = 'none' | 'mono' | 'warm' | 'cool' | 'vivid';
// Caption font style: auto = language-matched Noto Sans (free, server-fetched);
// title/hand = Korean display faces (Black Han Sans / Nanum Pen Script).
export type CaptionFont = 'auto' | 'title' | 'hand';
export type EditClip = {
  videoId: string;
  start?: number;
  end?: number;
  text?: string;
  textPosition?: TextPosition;
  speed?: number;
  filter?: ClipFilter;
  font?: CaptionFont;
};
export type EditRequest = { title: string; clips: EditClip[]; audioKey?: string; keepAudio?: boolean };

export type ExploreItem = {
  id: string;
  title: string;
  prompt: string;
  author: string;
  likes: number;
  durationLabel: string;
  accent: string;
  tierLabel: string;
  url?: string | null;
  createdLabel?: string;
  comments?: number;
  views?: number;
  shares?: number;
  watches?: number; // completed watches (played to the end)
  aspect?: string; // the shape it was rendered at — decides its feed lane
  likedByMe?: boolean; // whether the calling account liked it (signed in only)
  followedByMe?: boolean; // whether the calling account follows its creator
  createdAt?: number;
  // Full recipe — powers "use this template" in the director.
  // REDACTED by the server unless the creator opted in or you are the creator:
  // publishing a film is not publishing how it was made. Remix still works
  // either way, because it re-seeds from the recipe server-side.
  scenePrompts?: string[] | null;
  stylePrompt?: string | null;
  promptPublic?: boolean;
  ownerId?: string | null; // publishing account (my-posts management)
  hidden?: boolean; // owner pulled it from the public feed (visible in /mine)
};
/** Which lane of the Explore feed — the shape of the player, really. */
export type Orientation = 'all' | 'vertical' | 'horizontal';

export type ExploreSort = 'popular' | 'latest';
export type ExploreComment = { id: string; author: string; text: string; createdLabel?: string };

// --- Conversational director (mirrors app/planner.py) ---
export type Scene = {
  index: number;
  heading: string;
  prompt: string;
  motion: string;
  seconds: number;
};
// `characters`: one canonical visual descriptor per recurring character; the
// director repeats it VERBATIM in every scene prompt featuring that character
// (each clip renders independently, so exact repetition is what keeps them
// looking identical — see ADR 0014).
export type Screenplay = { title: string; logline: string; style: string; characters?: string[]; scenes: Scene[] };
export type DirectorMessage = { role: 'user' | 'director'; content: string };
// Per-scene still previews rendered BEFORE the (expensive) video job.
export type StoryboardRequest = { scenePrompts: string[]; stylePrompt?: string };
export type Storyboard = {
  id: string;
  status: 'generating' | 'done' | 'failed';
  total: number;
  done: number;
  images: (string | null)[]; // playback paths per scene; null while rendering
};
export type DirectorChatRequest = { messages: DirectorMessage[]; seconds: number; tier: string };
export type DirectorTurn = { reply: string; screenplay?: Screenplay | null; ready: boolean };
// --- Accounts (mirrors app/auth.py) ---
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  provider: 'email' | 'google' | 'github' | 'apple';
  createdAt: number;
  planId?: string;
  credits?: number; // spendable generation credits (signup grants 100)
  providers?: string[]; // every login method connected to this account
  premium?: boolean; // paid plan OR purchased credit pack — unlocks paid features
};
export type SessionResult = { token: string; user: AuthUser };

// --- Admin console (mirrors app/routers/admin.py, ADR 0016) ---
export type AdminStats = {
  users: number;
  signups7d: number;
  activeSessions: number;
  videos: number;
  jobsQueued: number;
  jobsGenerating: number;
  jobsDone: number;
  jobsFailed: number;
  explorePosts: number;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  storageBytes: number;
  creditsOutstanding: number;
  generationBackend: string;
  plannerBackend: string;
};
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  providers: string[];
  planId: string;
  credits: number;
  createdAt: number;
  videos: number;
  hasByok: boolean;
};

export type AdminAuditEntry = {
  id: string;
  at: number;
  admin: string;
  action: string;
  target?: string;
  detail?: string;
};
export type AdminMetricPoint = {
  date: string;
  users: number;
  videos: number;
  explorePosts: number;
  likes: number;
  views: number;
  shares: number;
  watches: number;
  creditsOutstanding: number;
  storageBytes: number;
};

export type PublishRequest = { title: string; description?: string; visibility: Visibility; tags?: string[] };
export type PublishResult = { accepted: boolean; videoId: string; visibility: Visibility; url?: string | null };
