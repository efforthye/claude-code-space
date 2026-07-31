
## [2026-08-01] deploy | mayo → per-scene prompts must be DETAILED, ending on the final frame (batch 47)
- Owner: "초별 프롬프트 더 상세해야 할 듯." The chat director was explicitly
  told "one sentence per scene" — replaced across all three director prompts:
  every scene prompt is now 3-5 sentences walking the shot second by second
  (camera path, micro-actions in order, environment dynamics, palette) and must
  END by describing the FINAL frame — which is exactly the frame the next clip
  is generated from (batch 45 chaining), so written endings become real
  transitions. Verified: pytest 183 passed (server-only change).
