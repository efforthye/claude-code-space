#!/usr/bin/env bash
# watchdog-telegram — check the home server's vital signs and send a Telegram
# message when something crosses a threshold.
#
# Runs on the MINI, every few minutes, from the com.efforthye.watchdog launchd
# agent (see scripts/watchdog-install.sh).
#
# It watches the things Kibana cannot see, because they live outside Docker or
# outside the log stream entirely: the launchd agents, ComfyUI, disk space,
# container health, and whether the API actually answers.
#
# ALERT DISCIPLINE: a check that is failing does not re-notify every run. Each
# alert fires once on the transition into failure, then at most once every
# REPEAT_HOURS while it stays broken, and once more on recovery. Otherwise the
# alerts get muted by their reader, which is the same as having none.
#
# Secrets: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID come from the env file at
# ~/.mayo-watchdog.env (chmod 600, NEVER in the repo).

set -uo pipefail

ENV_FILE="${WATCHDOG_ENV:-$HOME/.mayo-watchdog.env}"
STATE_DIR="${WATCHDOG_STATE:-$HOME/.mayo-watchdog-state}"
ELK_DIR="${ELK_DIR:-$HOME/programs/work/creiip/claude-code-space/infra/elk}"
REPEAT_HOURS="${REPEAT_HOURS:-6}"

# --- thresholds ------------------------------------------------------------
DISK_PCT_MAX="${DISK_PCT_MAX:-85}"        # alert above this % used on /
MEM_FREE_PCT_MIN="${MEM_FREE_PCT_MIN:-15}" # alert below this % system-wide free
CONTAINER_MEM_PCT_MAX="${CONTAINER_MEM_PCT_MAX:-90}" # % of a container's own limit
# JVM heap, which is the number that actually predicts an Elasticsearch OOM.
# 85 rather than 90: above ~85% the GC starts spending real time on full
# collections, so this is meant to fire while there is still room to act.
ES_HEAP_PCT_MAX="${ES_HEAP_PCT_MAX:-85}"

# --- alert glyphs ----------------------------------------------------------
# Override in the env file if you want a different set. Keep failure and
# recovery visually unmistakable at a glance in a notification list.
EMOJI_FAIL="${EMOJI_FAIL:-💥}"
EMOJI_RECOVER="${EMOJI_RECOVER:-🩹}"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE missing. Copy scripts/watchdog.env.example and fill it in."; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN not set in $ENV_FILE}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID not set in $ENV_FILE}"

mkdir -p "$STATE_DIR"
HOST="$(hostname -s)"
NOW="$(date +%s)"

send() { # send <text>
  curl -sf -m 20 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" \
    --data-urlencode "disable_web_page_preview=true" \
    >/dev/null || echo "WARN: telegram send failed"
}

# report <check-id> <ok|fail> <message>
#   Emits only on transitions, or every REPEAT_HOURS while still failing.
report() {
  local id="$1" status="$2" msg="$3"
  local f="$STATE_DIR/$id"
  local prev="ok" last=0
  [ -f "$f" ] && { prev="$(cut -d' ' -f1 "$f")"; last="$(cut -d' ' -f2 "$f")"; }

  if [ "$status" = "fail" ]; then
    local age=$(( NOW - last ))
    if [ "$prev" != "fail" ]; then
      send "${EMOJI_FAIL} [$HOST] $msg"
      echo "fail $NOW" > "$f"
    elif [ "$age" -ge $(( REPEAT_HOURS * 3600 )) ]; then
      send "${EMOJI_FAIL} [$HOST] (계속) $msg"
      echo "fail $NOW" > "$f"
    fi
  else
    if [ "$prev" = "fail" ]; then
      send "${EMOJI_RECOVER} [$HOST] 복구됨 — $msg"
    fi
    echo "ok $NOW" > "$f"
  fi
}

# --- disk ------------------------------------------------------------------
disk_used=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "$disk_used" ] && [ "$disk_used" -ge "$DISK_PCT_MAX" ]; then
  report disk fail "디스크 사용량 ${disk_used}% (임계 ${DISK_PCT_MAX}%)"
else
  report disk ok "디스크 사용량 ${disk_used}%"
fi

# --- system memory ---------------------------------------------------------
mem_free=$(memory_pressure 2>/dev/null | awk -F': ' '/free percentage/ {gsub("%","",$2); print $2}')
if [ -n "$mem_free" ] && [ "$mem_free" -le "$MEM_FREE_PCT_MIN" ]; then
  report mem fail "시스템 여유 메모리 ${mem_free}% (임계 ${MEM_FREE_PCT_MIN}%)"
else
  report mem ok "시스템 여유 메모리 ${mem_free}%"
fi

# --- launchd agents --------------------------------------------------------
# A crashed agent shows a non-zero last exit status, or vanishes from the list.
for agent in mayo.api mayo.expo mayo.autopull mayo.tunnel mayo.comfy; do
  label="com.efforthye.${agent}"
  line=$(launchctl list 2>/dev/null | awk -v l="$label" '$3==l {print $1}')
  if [ -z "$line" ]; then
    report "agent-${agent}" fail "launchd 에이전트 정지: ${label}"
  else
    report "agent-${agent}" ok "${label} 실행 중"
  fi
done

# --- docker containers -----------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  for name in richclub-api richclub-front jenkins elasticsearch kibana filebeat; do
    state=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null)
    if [ -z "$state" ]; then
      continue   # not deployed on this host — not a failure
    elif [ "$state" != "running" ]; then
      report "ctr-${name}" fail "컨테이너 ${name} 상태: ${state}"
      continue
    fi
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null)
    if [ -n "$health" ] && [ "$health" != "healthy" ]; then
      report "ctr-${name}" fail "컨테이너 ${name} 헬스체크: ${health}"
    else
      report "ctr-${name}" ok "컨테이너 ${name} 정상"
    fi
  done

  # Memory pressure per container, as a % of its own limit. This is the signal
  # that preceded the ELK OOM risk found on 2026-07-31.
  #
  # JVM containers are exempt and checked on their HEAP instead (below). A JVM
  # claims its container's memory and does not hand it back, so Elasticsearch
  # sat at 90-97% of its limit while its heap was 55% used and it held a few MB
  # of data — healthy, and alerting every cycle. Resident size against a limit
  # is not a fault for a process designed to fill that limit; heap exhaustion is.
  while IFS=$'\t' read -r cname cperc; do
    [ -z "$cname" ] && continue
    case "$cname" in elasticsearch|kibana) continue ;; esac
    pct=${cperc%%.*}
    [ -z "$pct" ] && continue
    if [ "$pct" -ge "$CONTAINER_MEM_PCT_MAX" ]; then
      report "ctrmem-${cname}" fail "컨테이너 ${cname} 메모리 ${cperc}% (한도 대비, 임계 ${CONTAINER_MEM_PCT_MAX}%)"
    else
      report "ctrmem-${cname}" ok "컨테이너 ${cname} 메모리 ${cperc}%"
    fi
  done < <(docker stats --no-stream --format '{{.Name}}\t{{.MemPerc}}' 2>/dev/null | tr -d '%')

  # Elasticsearch: heap is the number that predicts trouble. Sustained high heap
  # means the GC is fighting to keep up and an OOM is ahead of you; container RSS
  # means the JVM was given memory and took it.
  if [ -n "${ELASTIC_PASSWORD:-}" ]; then
    es_heap=$(curl -sf -m 10 -u "${ELASTIC_USER:-elastic}:${ELASTIC_PASSWORD}" \
      "http://127.0.0.1:${ELASTIC_PORT:-9200}/_nodes/stats/jvm" 2>/dev/null |
      sed -n 's/.*"heap_used_percent":\([0-9]*\).*/\1/p' | head -1)
    if [ -n "$es_heap" ]; then
      if [ "$es_heap" -ge "$ES_HEAP_PCT_MAX" ]; then
        report es-heap fail "Elasticsearch 힙 ${es_heap}% (임계 ${ES_HEAP_PCT_MAX}%)"
      else
        report es-heap ok "Elasticsearch 힙 ${es_heap}%"
      fi
    fi
  fi
fi

# --- mayo-api actually answers ---------------------------------------------
if curl -sf -m 10 "http://localhost:${MAYO_PORT:-8001}/health" >/dev/null 2>&1; then
  report mayo-api-health ok "mayo-api /health 응답 정상"
else
  report mayo-api-health fail "mayo-api /health 무응답 (localhost:${MAYO_PORT:-8001})"
fi

# --- elasticsearch cluster health ------------------------------------------
if [ -f "$ELK_DIR/.env" ]; then
  # shellcheck disable=SC1091
  es_pw=$(awk -F= '/^ELASTIC_PASSWORD=/{print substr($0, index($0,"=")+1)}' "$ELK_DIR/.env")
  if [ -n "$es_pw" ]; then
    es_status=$(curl -sf -m 10 -u "elastic:${es_pw}" "http://localhost:9200/_cluster/health" 2>/dev/null \
      | sed -n 's/.*"status":"\([a-z]*\)".*/\1/p')
    if [ -z "$es_status" ]; then
      report es-health fail "Elasticsearch 무응답"
    elif [ "$es_status" = "red" ]; then
      report es-health fail "Elasticsearch 클러스터 status=red"
    else
      report es-health ok "Elasticsearch status=${es_status}"
    fi
  fi
fi

exit 0
