---
title: Operate the Home Server from your Phone (Claude Remote Control)
type: runbook
tags: [runbook, claude-code, remote-control, mobile, ops]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Operate the Home Server from your Phone (Claude Remote Control)

Goal: drive a Claude Code session **from your phone**, from anywhere, while the actual execution
(Docker, deploys, file edits, SSH, `.env`) happens **on the [[home-server]]** — full local
access, no cloud sandbox limits.

> **Why not Claude Code on the web?** Web sessions run in an Anthropic-managed cloud VM that
> **cannot reach your home network** (no private routes; SSH blocked) and that isolation can't be
> reconfigured. So the web sandbox can never touch the mini. **Remote Control** solves this by
> running the session *on the mini* and only steering it from the phone.

## Option A — Remote Control (recommended)
Runs the session on the mini; your phone is just the remote UI. Connection is outbound TLS to
Anthropic — **no inbound ports opened** on the server.

**On the mini** (one time per session), in the project dir:
```bash
cd ~/claude-code-space          # or the app/project you want to work in
claude remote-control           # prints a session URL + QR code
```

**On the phone:**
1. Install the **Claude** app — iOS: App Store · Android: Play Store (or use `claude.ai/code` in
   the phone browser).
2. **Scan the QR** shown in the mini's terminal, or paste the session URL into the app.
3. Now steer from the phone: e.g. *"richclub-api 재배포해줘"*, *"docker 안 쓰는 이미지 정리해줘"*,
   *"jenkins 로그 확인해줘"* — Claude runs it **on the mini** and reports back.

Notes:
- Execution, filesystem, Docker, SSH keys, and `.env` all stay on the mini.
- The session persists if the mini sleeps and reconnects automatically.
- You can send images/files from the phone; they land on the mini for Claude to use.

## Option B — SSH + `claude` (simplest, terminal UX)
You already SSH to the mini from the phone (Termius). Just run Claude there:
```bash
ssh <user>@home.efforthye.com   # from Termius on the phone
claude                          # full local Claude Code session on the server
```
Same full access; the only downside is you're typing in a terminal instead of the app UI.

## This is what makes the wiki real
With Claude running on the mini (driven from the phone), the same session can **both** operate
the server **and** keep this wiki current — do the deploy, then update the [[home-server]] /
service page and append to `log.md`, all in one place. Clone this repo on the mini so that
context is right there.

## Related
- Host: [[home-server]] · CI: [[jenkins]] · App workspace: `apps/` ([[mobile-app]])
