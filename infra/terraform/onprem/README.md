# Terraform — home-server infrastructure (Phase 1)

Declarative state for the parts of the [home server](../../wiki/infra/home-server.md)
that live behind an API. Rationale and scope: [ADR 0018](../../wiki/decisions/0018-terraform-for-onprem-infra.md).

**Phase 1 covers:** Docker containers on the mini, and Cloudflare DNS records on
the `efforthye.dev` zone.

**Phase 1 deliberately does NOT cover:**

| Not managed | Why |
|---|---|
| launchd agents (expo, autopull, mayo-api, tunnel) | No Terraform resource exists; `local-exec` wrappers are an anti-pattern. Stays with `scripts/mayo-autostart-install.sh`. |
| The cloudflared tunnels themselves | Created and owned by the shell agents, with credential files on the mini. Terraform manages only the DNS records pointing at them. |
| Vercel, GitHub | Phase 2. |
| macOS host configuration | Terraform provisions; it is not a config-management tool. |

## Run it on the mini

Terraform talks to the local Docker socket, and reuses the mini's existing
Cloudflare setup. Run it **on the mini**, not from a laptop:

```bash
cd ~/programs/work/creiip/claude-code-space          # canonical repo path on the mini
./scripts/tf-discover.sh                             # snapshot reality (redacted)
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
$EDITOR infra/terraform/terraform.tfvars             # fill in zone + tunnel UUIDs
export CLOUDFLARE_API_TOKEN=<token>                  # Zone:DNS:Edit on efforthye.dev
cd infra/terraform && terraform init
```

## Adopt, don't recreate

Every resource here **already exists and is serving traffic**. Never run a bare
`terraform apply` against an empty state — it would try to create duplicates,
and a name collision on `jenkins` or `richclub-api` is an outage.

The order is always:

1. `./scripts/tf-discover.sh` writes `imports.generated.tf` with the real
   container IDs. Add the Cloudflare record IDs to it by hand (the discovery
   output prints the exact `curl` to list them).
2. `terraform plan` — read it line by line. The goal is **no `destroy`, no
   `replace`, no `create`.** Only "will be imported" plus, at most, in-place
   attribute updates you actually intend.
3. Where the plan wants to change something that should not change, fix the
   `.tf` to match reality — not the other way round.
4. Only when the plan is clean: `terraform apply`.
5. Delete the `import` blocks once adoption is recorded in state.

**Expect friction on `docker_container`.** The kreuzwerker provider does not
round-trip every attribute on import (`attach`, `logs`, `must_run`, `start`,
and some `healthcheck`/`init` defaults are common offenders). Resolve by
matching the config to the running container, or adding a targeted
`lifecycle { ignore_changes = [...] }`. Do not resolve it by letting Terraform
recreate the container.

## State contains secrets

Terraform state stores every read attribute in **plaintext**, including
container env values it picks up on import. That collides head-on with this
repo's "no secrets, ever" rule, so:

- `*.tfstate*`, `*.tfvars`, `.terraform/` and `imports.generated.tf` are
  gitignored — verify with `git status` before every commit.
- State stays on the mini. If it ever needs to be shared, move to a remote
  backend with encryption at rest; do not commit it.
- `docker.tf` sets `ignore_changes = [env]` so Terraform neither manages nor
  fights over credential-bearing environment variables.

## Files

| File | What |
|---|---|
| `versions.tf` | Terraform + provider version pins, local backend |
| `providers.tf` | Docker and Cloudflare provider configuration |
| `variables.tf` | Inputs, all documented |
| `docker.tf` | The three (soon four) containers on the mini |
| `cloudflare.tf` | Proxied CNAMEs for the tunnel hostnames |
| `terraform.tfvars.example` | Template — copy to the gitignored `terraform.tfvars` |