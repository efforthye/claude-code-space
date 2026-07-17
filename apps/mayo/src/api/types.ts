// Wire types for the mayo-api backend. These mirror the FastAPI schemas in
// apps/mayo-api/app/schemas.py exactly.

export type JobStatus = 'queued' | 'generating' | 'done' | 'failed';
export type Visibility = 'private' | 'unlisted' | 'public';
export type ModelKind = 'image' | 'video';

export type Tier = { id: string; label: string; blurb: string; pricePerMin: number };
export type Duration = { id: string; label: string; seconds: number };
export type Plan = { id: string; monthly: number; storageMb?: number };
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
  // Consistency block (style + character sheet) prepended to every scene render.
  stylePrompt?: string | null;
  // Credits charged at create — cancelling refunds the unrendered share.
  chargedCredits?: number | null;
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
export type Estimate = { seconds: number; tier: string; credits: number };
export type Health = { status: string; env: string; storage: string };

export type CreateJobRequest = {
  prompt: string;
  seconds: number;
  tier: string;
  scenePrompts?: string[];
  // Style + character-sheet block repeated into every scene render so recurring
  // characters keep the same look across independently generated clips.
  stylePrompt?: string;
};
export type RuntimeSettings = {
  generationBackend: string;
  plannerBackend?: PlannerBackend;
  directorModel?: string;
  byok?: boolean;
};

export type TextPosition = 'top' | 'center' | 'bottom';
export type ClipFilter = 'none' | 'mono' | 'warm' | 'cool' | 'vivid';
export type EditClip = {
  videoId: string;
  start?: number;
  end?: number;
  text?: string;
  textPosition?: TextPosition;
  speed?: number;
  filter?: ClipFilter;
};
export type EditRequest = { title: string; clips: EditClip[]; audioKey?: string };

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
  createdAt?: number;
  // Full recipe — powers "use this template" in the director.
  scenePrompts?: string[] | null;
  stylePrompt?: string | null;
};
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
};
export type SessionResult = { token: string; user: AuthUser };

export type PublishRequest = { title: string; description?: string; visibility: Visibility; tags?: string[] };
export type PublishResult = { accepted: boolean; videoId: string; visibility: Visibility; url?: string | null };
