# Higgsfield platform model catalog — pulled 2026-08-01

`GET https://platform.higgsfield.ai/models` with `Authorization: Key <id>:<secret>`
(the header scheme the SDK uses — `higgsfield_client/http/client.py:178`).

A free read. Worth knowing it exists: until now model ids were being guessed,
and a wrong guess costs a billed generation to discover.

| slug | operation | output | base credits |
|---|---|---|---|
| higgsfield-ai/dop/lite | image2video | video | 2.00 |
| higgsfield-ai/dop/lite/first-last-frame | image2video | video | 2.00 |
| higgsfield-ai/dop/standard | image2video | video | 9.00 |
| higgsfield-ai/dop/standard/first-last-frame | image2video | video | 9.00 |
| higgsfield-ai/dop/turbo | image2video | video | 6.50 |
| higgsfield-ai/dop/turbo/first-last-frame | image2video | video | 6.50 |
| higgsfield-ai/popcorn/auto | text2image | image | 1.47 |
| higgsfield-ai/soul/character | text2image | image | 1.00 |
| higgsfield-ai/soul/cinema | text2image | image | 0.00 |
| higgsfield-ai/soul/reference | text2image | image | 1.00 |
| higgsfield-ai/soul/standard | text2image | image | 1.00 |
| higgsfield-ai/soul/v2/standard | text2image | image | 0.00 |
| soul | text2image | image | 0.00 |
| soul-id | character | image | 40.00 |

## What this settles

**There is no text-to-video model.** All six video models are `image2video`.
A clip cannot be made without a still — so "skip the image stage" cannot mean
"generate no image". It can only mean "do not stop for review": generate the
stills, auto-approve them, and go straight to clips. Anything else would be
promising something the provider does not offer.

**Reference images are supported** — `higgsfield-ai/soul/reference`, one credit,
same price as the plain still we already generate. `soul-id` (40 credits) is the
heavier character-identity path; `soul/character` is the cheap one.

**`first-last-frame` variants exist at the same price as their base model.**
This matters more than it looks. Continuity today is one-ended: a clip starts
from the previous clip's last frame and ends wherever it wants (`segments.py:
continuity_source`). Pinning both ends means a clip lands on the next segment's
still instead of drifting toward it — the difference between a cut and a jump —
and it costs nothing extra.

**Pricing sanity check.** `soul/standard` is 1.00 credit, which is exactly the
measured image cost behind ADR 0017 v3.1. `dop/lite` at 2.00 base against a
measured 5.83 per scene is the duration multiplier, not a discrepancy.
