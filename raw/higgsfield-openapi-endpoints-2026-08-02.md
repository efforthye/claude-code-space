# Higgsfield platform API — the real endpoint list (2026-08-02)

Source: `https://docs.higgsfield.ai/docs/openapi.json`, found via the docs index
at `https://docs.higgsfield.ai/docs/llms.txt`.

**This corrects two conclusions recorded on 2026-08-01.** Those were drawn from
`GET /models`, which returns only 14 entries — a small subset of what the key can
actually call. The OpenAPI spec lists 48 model endpoints.

## Correction 1 — text-to-video exists

2026-08-01 recorded "there is no text-to-video model; all six video models are
image2video, so the image stage cannot be skipped". That is wrong. The spec has:

- `/veo3.1`, `/veo3.1/fast` — text to video, with `generate_audio`
- `/sora-2/text-to-video`, `/sora-2/text-to-video/pro`
- `/bytedance/seedance/v1/lite/text-to-video`, `/bytedance/seedance/v1/pro/fast/text-to-video`
- `/kling-video/v2.1/master/text-to-video`, `/kling-video/v2.5-turbo/pro/text-to-video`
- `/minimax/hailuo-*/text-to-video`, `/wan-25-preview/text-to-video`

So "generate without the image stage" is buildable after all.

## Correction 2 — Veo, Seedance, Kling and Sora need no second vendor

2026-08-01 recorded that reaching Seedance would mean a Volcano Engine
integration and Veo a Google account. Both are reachable on the Higgsfield key
we already hold. That removes the main cost of the model-diversification work in
MAYO-36 — it is a catalogue entry and an argument map, not a new vendor.

## The parameter that was being hunted

`/higgsfield-ai/dop/{lite,standard,turbo}` — the models already in use:

| field | required |
|---|---|
| `prompt` | yes |
| `image_url` | yes |
| `end_image_url` | no |
| `motions` (array) | no |
| `enhance_prompt` (bool) | no |
| `seed` (int) | no |

**`end_image_url` is on the base endpoint.** The `/first-last-frame` slugs that
appear in `GET /models` are absent from the documented API and are not needed.

Two other fields here are unused and worth a look: `motions` is presumably the
camera-move preset library Higgsfield markets, and `enhance_prompt` is a
server-side prompt rewrite.

## First/last frame elsewhere

`/veo3.1/first-last-frame-to-video` and `/veo3.1/fast/first-last-frame-to-video`
take `first_frame_url` + `last_frame_url` (both required) plus `generate_audio`,
`duration`, `resolution`, `aspect_ratio`. Different names from DoP's — worth
remembering when the backend seam gains a second provider.

## Full endpoint list

```
/higgsfield-ai/dop/{turbo,lite,standard}
/higgsfield-ai/popcorn/auto
/higgsfield-ai/soul/{character,reference,standard}
/veo3.1  /veo3.1/image-to-video  /veo3.1/first-last-frame-to-video
/veo3.1/fast  /veo3.1/fast/image-to-video  /veo3.1/fast/first-last-frame-to-video
/veo3.1/reference-to-video
/bytedance/seedance/v1/lite/{image-to-video,text-to-video}
/bytedance/seedance/v1/pro/fast/{image-to-video,text-to-video}
/kling-video/v2.1/{master,pro,standard}/...
/kling-video/v2.5-turbo/{pro,standard}/...
/minimax/hailuo-02/{pro,standard}/...  /minimax/hailuo-2.3{,-fast}/...
/sora-2/{image-to-video,text-to-video}{,/pro}
/wan-25-preview/{image-to-video,text-to-video}
/nano-banana  /flux-pro/kontext/max/text-to-image
/reve/{edit,remix,text-to-image}  /reve/fast/{edit,remix}
```

## Lesson

`GET /models` is not the catalogue. It answered with 14 models and no schemas
(`input_schema: null`), which made the API look far smaller and less documented
than it is, and sent two decisions the wrong way. The documentation index at
`/docs/llms.txt` — the convention this project already publishes for its own
site — led to the spec in two fetches.
