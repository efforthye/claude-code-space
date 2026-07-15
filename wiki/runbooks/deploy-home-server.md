---
title: Deploy to Home Server (GitHub Actions)
type: runbook
tags: [runbook, deploy, github-actions, home-server]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Deploy to the Home Server via GitHub Actions

The shared deploy path for services on the [[home-server]]. Push-based: a GitHub Actions
workflow uses the **`HOME_SERVER` Environment** to get credentials, then SSHes in to ship.

> Status: **path defined, not yet exercised.** No deploy workflow or service exists yet. Update
> this runbook with the real, reproducible steps once the first service ships.

## Prerequisites
- Repo Environment **`HOME_SERVER`** exists with secrets `HOME_SERVER_URL`, `HOME_SERVER_USER`,
  `HOME_SERVER_SECRET` (see [[home-server]]). ✅ done.
- (Optional) Deployment protection rules on the environment — required reviewers, wait timer, or
  allowed branches — configured to taste in repo Settings → Environments → HOME_SERVER.

## The pipeline (intended shape)
1. Trigger: push to the deploy branch (or a manual `workflow_dispatch`).
2. Build the service (and/or its Docker image).
3. Job declares `environment: HOME_SERVER` → GitHub injects the three secrets into that job only.
4. Connect over SSH to `${{ secrets.HOME_SERVER_URL }}` as `${{ secrets.HOME_SERVER_USER }}`
   using `${{ secrets.HOME_SERVER_SECRET }}`.
5. Pull/copy the new version, write any per-service `.env` on the host (never in git), restart
   the service (e.g. `docker compose up -d`).
6. Health-check, then report.

## Workflow skeleton (to adapt per service)
```yaml
# .github/workflows/deploy.yml  — NOT YET CREATED; template only
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: HOME_SERVER          # <- unlocks the environment secrets
    steps:
      - uses: actions/checkout@v4
      # build / package here …
      - name: Deploy over SSH
        # secrets referenced as ${{ secrets.HOME_SERVER_URL }} etc. — never hardcode values
        run: |
          echo "connect to $HOST as $USER and deploy"   # fill in real steps
        env:
          HOST: ${{ secrets.HOME_SERVER_URL }}
          USER: ${{ secrets.HOME_SERVER_USER }}
          # HOME_SERVER_SECRET wired into the SSH action/step as key or token
```

## Secrets rule
Reference secrets via the `secrets` context only. **Never** echo them into logs, commit `.env`
files, or paste values into the wiki. Per-service env values live on the host or in the
`HOME_SERVER` environment — the wiki records only the *names*.

## After a deploy — update the wiki
Per [[CLAUDE|the schema]], one deploy touches several pages:
1. Service page: `status`, running version/commit, URL/port.
2. This runbook, if the steps changed.
3. [[home-server]] / other [[infra]] pages, if infra changed.
4. Append to `log.md`: `## [YYYY-MM-DD] deploy | <name> → <version/summary>`.

## Related
- Infra: [[home-server]]
- Decision: [[0001-github-actions-home-server-deploy]]
