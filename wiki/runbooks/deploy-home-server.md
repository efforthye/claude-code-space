---
title: Deploy to Home Server (GitHub Actions)
type: runbook
tags: [runbook, deploy, github-actions, home-server]
created: 2026-07-15
updated: 2026-07-15
---

# Runbook — Deploy to the Home Server

> ⚠️ **The current deploy path is Jenkins + GitHub webhooks, not GitHub Actions.** See
> [[jenkins]] and [[0002-cicd-via-jenkins-webhook]]. Jenkins builds the arm64 Docker image and
> redeploys on push. The Jenkinsfile / exact job steps still need documenting here.
>
> The GitHub Actions + `HOME_SERVER` environment approach below is **kept for reference only**
> (superseded, [[0001-github-actions-home-server-deploy]]); use it only if we adopt an
> Actions-based path later.

---

## (Reference, unused) Deploy via GitHub Actions + `HOME_SERVER` environment

Push-based: a GitHub Actions workflow uses the **`HOME_SERVER` Environment** to get credentials,
then SSHes in to ship. Not currently wired up.

## Prerequisites
- Repo Environment **`HOME_SERVER`** exists with secrets `HOME_SERVER_URL`, `HOME_SERVER_USER`,
  `HOME_SERVER_SECRET` (see [[home-server]]). ✅ done.
- (Optional) Deployment protection rules on the environment — required reviewers, wait timer, or
  allowed branches — configured to taste in repo Settings → Environments → HOME_SERVER.

## The pipeline (intended shape)
1. Trigger: push to the deploy branch (or a manual `workflow_dispatch`).
2. Build the service Docker image (build on the runner and push to a registry, or build on the
   host — decide per service).
3. Job declares `environment: HOME_SERVER` → GitHub injects the three secrets into that job only.
4. Connect over **SSH with password auth** to `${{ secrets.HOME_SERVER_URL }}` as
   `${{ secrets.HOME_SERVER_USER }}` using the password `${{ secrets.HOME_SERVER_SECRET }}`.
5. On the host: pull/build the image, write any per-service `.env` (never in git), then
   `docker compose up -d` to (re)start the container.
6. Health-check, then report.

## Workflow skeleton (to adapt per service)
Password-based SSH — `appleboy/ssh-action` takes a `password:` input, so no key setup needed.

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
      # optional: build & push the image here …
      - name: Deploy over SSH (password auth) and run with Docker
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HOME_SERVER_URL }}
          username: ${{ secrets.HOME_SERVER_USER }}
          password: ${{ secrets.HOME_SERVER_SECRET }}   # SSH login password
          script: |
            cd /opt/<service>            # per-service dir on the host
            git pull                     # or: docker pull <image>
            docker compose up -d --build
            docker compose ps
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
