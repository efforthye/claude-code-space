---
title: Terraform (on-prem)
type: infra
status: building
tags: [infra, terraform, docker, cloudflare, home-server, iac]
created: 2026-07-31
updated: 2026-07-31
---

# Terraform (on-prem)

Infrastructure as code for the [[home-server]] mini. Scope, exclusions and the
honest assessment of what this buys: [[0018-terraform-for-onprem-infra]].

**Code location:** `infra/terraform/onprem/` in this repo.
**Runs on:** the mini, against the local Docker socket.

## Managed

| Resource | Provider | Real state today |
|---|---|---|
| `richclub-api` (`:8000`), `richclub-front` (`:3000`), `jenkins` (`:9090`, `:50000`) | `kreuzwerker/docker` 3.9.x | Running; verified on the mini 2026-07-31 |
| CNAMEs `richclub` / `richclub-client` / `mayo-api` on `efforthye.dev` | `cloudflare/cloudflare` 5.22.x | Proxied CNAMEs to `<tunnel-uuid>.cfargotunnel.com` |

Not managed: the launchd agents, the cloudflared tunnels themselves, the
[[elk]] stack (Compose owns it), and macOS host configuration. The rule is
**one container, one tool** — see the ADR.

## Status — written and validated, not yet applied

`terraform validate` and `terraform fmt` pass against the real provider schemas
(Terraform 1.15.8, docker 3.9.0, cloudflare 5.22.0). Nothing has been imported
or applied yet. `docker.tf` was written from the [[home-server]] snapshot, so
volumes and restart policies are **unverified guesses** until discovery runs.

## Adopting the running system

Everything here already exists and serves traffic, so adoption is import-only.
A bare `apply` against empty state would try to create duplicates — a name
collision on `jenkins` is an outage.

```bash
ssh m1mini
cd ~/programs/work/creiip/claude-code-space
./scripts/tf-discover.sh                 # real state -> raw/, import blocks -> onprem/
cp infra/terraform/onprem/terraform.tfvars.example infra/terraform/onprem/terraform.tfvars
$EDITOR infra/terraform/onprem/terraform.tfvars     # zone id + tunnel UUIDs
export CLOUDFLARE_API_TOKEN=<Zone:DNS:Edit on efforthye.dev>
cd infra/terraform/onprem && terraform init && terraform plan
```

**Completion criterion:** a plan with **no create, no replace, no destroy** —
only imports plus in-place edits you intended. Where the plan wants to change
something that should not change, fix the `.tf` to match reality, never the
reverse. Expect friction on `docker_container`: the provider does not
round-trip every attribute on import.

`scripts/tf-discover.sh` reduces environment variables to **key names only**, so
richclub's credentials never reach `raw/`.

## Secrets

Terraform state records every read attribute in plaintext. `*.tfstate*`,
`*.tfvars`, `.terraform/` and `imports.generated.tf` are gitignored; state stays
on the mini. `docker.tf` sets `ignore_changes = [env]` so Terraform neither
manages nor fights over credential-bearing environment variables. The Cloudflare
token is supplied as `CLOUDFLARE_API_TOKEN` in the environment, never written to
a file in the repo.

## Related

- Decision: [[0018-terraform-for-onprem-infra]] · Host: [[home-server]]
- Managed services: [[richclub]] · [[jenkins]] · DNS for [[mayo]]'s API tunnel
- Deliberately Compose instead: [[elk]] / [[0019-centralised-logging-elk]]
