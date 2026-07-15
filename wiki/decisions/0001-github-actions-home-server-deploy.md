---
title: "ADR 0001: Deploy to the home server via GitHub Actions + Environment"
type: decision
status: superseded
tags: [decision, deploy, github-actions, secrets]
created: 2026-07-15
updated: 2026-07-15
superseded_by: 0002-cicd-via-jenkins-webhook
---

# ADR 0001 — Deploy to the home server via GitHub Actions + Environment

> ⚠️ **Superseded by [[0002-cicd-via-jenkins-webhook]].** This ADR reflected an assumed plan;
> the actual CI/CD is Jenkins triggered by GitHub webhooks ([[jenkins]]). The `HOME_SERVER`
> GitHub environment/secrets described below were created but are **not currently used**. Kept
> for history and as a possible future option.

## Context
Services built in this repo need to reach a self-hosted [[home-server]]. We need a repeatable
deploy path and a safe home for the deploy credentials (host address, SSH user, auth secret)
without ever committing those values to git.

## Options considered
1. **Manual SSH / scripts from a laptop** — simple, but not reproducible, credentials scattered
   on dev machines, no audit trail.
2. **GitHub Actions + a repo Environment** — push-based CI/CD; secrets stored as encrypted
   Environment secrets, injected only into jobs that declare that environment; optional
   protection rules (reviewers, wait timers, branch limits); a run history for auditing.
3. **External secret manager (Vault / Infisical / SOPS) + pull-based deploy** — powerful, but
   more moving parts than needed at this stage.

## Decision
Use **GitHub Actions gated by the `HOME_SERVER` Environment**. Deploy credentials live as
Environment secrets — `HOME_SERVER_URL`, `HOME_SERVER_USER`, `HOME_SERVER_SECRET` — and a
workflow declaring `environment: HOME_SERVER` connects over **SSH (password auth,
`HOME_SERVER_SECRET`)** to run the service with **Docker** (`docker compose up -d`).

## Consequences
- ✅ Credentials never touch git; they're referenced via the `secrets` context at run time only.
- ✅ Reproducible deploys with history; can add required reviewers / branch limits later.
- ✅ The wiki records only secret *names* (pointers), satisfying the [[CLAUDE|secrets rule]].
- ⚠️ Deploys depend on GitHub Actions availability; the runner needs network reach to the home
   server (SSH exposed to the runner, or a self-hosted runner on the LAN).
- ⚠️ Per-service `.env` values still need a home on the host — decide per service, keep out of git.
- ⚠️ `HOME_SERVER_SECRET` is an **SSH password** — simpler than keys but weaker; consider moving
  to key-based auth as a later hardening step.
- 🔜 Follow-up: create the actual `.github/workflows/deploy.yml`, and decide self-hosted vs.
  GitHub-hosted runner (a home server behind a router usually favors a self-hosted runner).

## Related
- Infra: [[home-server]] · Runbook: [[deploy-home-server]]
