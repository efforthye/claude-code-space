#!/usr/bin/env bash
# comfy-smoke — submit the AnimateLCM text->video workflow to ComfyUI and wait
# for the clip, so we can confirm the model + workflow actually generate before
# wiring it into mayo-api. Prints validation errors (if any) or the elapsed time
# + output filename.
#
# Usage (on the mini):  ./scripts/comfy-smoke.sh ["your prompt"]

set -eo pipefail

COMFY="${MAYO_COMFY_URL:-http://127.0.0.1:8188}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WF="$ROOT/apps/mayo-api/workflows/animatelcm_t2v.json"
PROMPT="${1:-a red fox trotting through a snowy forest, cinematic, soft light}"

BODY=$(python3 - "$WF" "$PROMPT" <<'PY'
import json, sys
wf = json.load(open(sys.argv[1]))
wf["6"]["inputs"]["text"] = sys.argv[2]
print(json.dumps({"prompt": wf}))
PY
)

echo "== submitting to $COMFY =="
resp=$(curl -s -X POST "$COMFY/prompt" -H "Content-Type: application/json" -d "$BODY")
pid=$(printf '%s' "$resp" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("prompt_id",""))' 2>/dev/null || true)

if [ -z "$pid" ]; then
  echo "!! no prompt_id returned — validation error below:"
  printf '%s\n' "$resp"
  exit 1
fi

echo "queued prompt_id=$pid — generating (the FIRST run loads the model, so be patient)…"
start=$(date +%s)
while true; do
  h=$(curl -s "$COMFY/history/$pid")
  ready=$(printf '%s' "$h" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("yes" if d else "no")' 2>/dev/null || echo no)
  [ "$ready" = "yes" ] && break
  sleep 3
done
echo "== DONE in $(( $(date +%s) - start ))s =="
printf '%s' "$h" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for pid, rec in d.items():
    for nid, o in rec.get("outputs", {}).items():
        for g in o.get("gifs", []) + o.get("videos", []):
            print("output file:", g.get("filename"))
    if rec.get("status", {}).get("status_str") == "error":
        print("STATUS: error —", json.dumps(rec.get("status")))
'
echo "(saved under ~/programs/ComfyUI/output/)"
