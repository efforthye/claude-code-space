---
title: Terraform for on-prem infrastructure
type: decision
status: accepted
tags: [decision, infra, terraform, home-server, docker, cloudflare]
created: 2026-07-31
updated: 2026-07-31
---

# 0018 — Terraform for on-prem infrastructure

## Context

Everything on the [[home-server]] was provisioned by hand or as a side effect of
a shell script, and none of it is written down as configuration:

- The three Docker containers ([[richclub]] api + front, [[jenkins]]) exist only
  as `docker run` invocations inside a Jenkins job. If the mini's disk died, the
  only recovery path would be memory.
- The three Cloudflare DNS records on the `efforthye.dev` zone were created as a
  side effect of `scripts/mayo-tunnel-run.sh` and the older richclub setup.
  Nothing records what exists or why.

The owner has used Terraform professionally and wants it here. Launch is
**on-prem on the M1 mini**; a move to a cloud provider is a someday-maybe and is
explicitly **not** being designed for now (owner, 2026-07-31).

## Decision

Adopt **Terraform** (HashiCorp, not OpenTofu — owner preference) for the parts
of the mini that sit behind an API, at `infra/terraform/onprem/`.

**In scope:**

| Resource | Provider |
|---|---|
| The mini's long-lived Docker containers | `kreuzwerker/docker` 3.9.x |
| Cloudflare DNS records on `efforthye.dev` | `cloudflare/cloudflare` 5.22.x |

**Out of scope, and why:**

| Excluded | Reason |
|---|---|
| The launchd agents (expo, autopull, mayo-api, tunnel, comfy) | No Terraform resource exists. Wrapping them in `local-exec` would be a lie told in HCL. They stay with `scripts/mayo-autostart-install.sh`. |
| The cloudflared **tunnels** themselves | Created and owned by the shell agents, credentials on disk. Importing them would let Terraform rotate a secret that takes every service offline. Terraform manages only the DNS records pointing at them. |
| The **ELK stack** ([[0019-centralised-logging-elk]]) | Multi-container with ordered startup and a one-shot bootstrap job — `depends_on: service_completed_successfully` has no Terraform equivalent. Compose owns it. |
| macOS host configuration | Terraform provisions; it is not a config-management tool. |
| AWS / Vercel / GitHub | Deferred. Launching on-prem first. |

**The boundary rule: one container, one tool.** A container managed by Compose
is never added to Terraform, and vice versa. Mixing owners is how drift starts.

## Consequences

**Adoption is import-only.** Every resource already exists and serves traffic.
`scripts/tf-discover.sh` reads the real state on the mini (redacting env values
to key names) and emits `import` blocks. The completion criterion for phase 1 is
a `terraform plan` with **no create, no replace, no destroy** — only imports and
intended in-place edits. Expect friction: the `kreuzwerker/docker` provider does
not round-trip every attribute on import.

**State holds secrets in plaintext**, which collides with this repo's
non-negotiable no-secrets rule. Mitigations: `*.tfstate*`, `*.tfvars`,
`.terraform/` and `imports.generated.tf` are gitignored; state stays on the
mini; `docker.tf` sets `ignore_changes = [env]` so Terraform never manages
credential-bearing environment variables.

**Terraform runs on the mini**, against the local Docker socket. Running it from
the laptop over `ssh://` is possible now that key auth exists, but the local
socket is simpler and keeps state on one machine.

**Honest assessment of value.** For three containers and three DNS records,
Terraform is close to overkill — Compose alone would cover the containers. The
value bought here is (a) a written, recoverable definition of infrastructure
that currently exists only as tribal knowledge, and (b) the same tool and
workflow already in the owner's hands. That is worth the state-file overhead;
a much larger claim would not be honest.

## Related

- Host: [[home-server]] · Services: [[richclub]] · [[jenkins]] · [[mayo]]
- Logging stack that deliberately uses Compose instead: [[0019-centralised-logging-elk]]
- Deploy paths this does not replace: [[deploy-mayo-api]] · [[mayo-dev-autosync]]
