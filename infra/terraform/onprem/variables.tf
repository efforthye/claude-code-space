variable "docker_host" {
  description = <<-EOT
    Docker daemon endpoint. Terraform is meant to run ON the home-server mini,
    so the default is the local Docker Desktop socket. Running it from another
    machine would need "ssh://user@host" plus key-based SSH to the mini (which
    does not exist today — the HOME_SERVER secret is a password).
  EOT
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "cloudflare_api_token" {
  description = <<-EOT
    Cloudflare API token with Zone:DNS:Edit on the efforthye.dev zone.
    Supply it via the CLOUDFLARE_API_TOKEN environment variable — never in a
    committed file. Left empty, the Cloudflare provider is unconfigured and
    only the Docker resources can be planned.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Zone ID of efforthye.dev. Fill in terraform.tfvars (gitignored)."
  type        = string
  default     = ""
}

variable "richclub_tunnel_id" {
  description = <<-EOT
    UUID of the named cloudflared tunnel serving richclub (the one configured in
    ~/.cloudflared/config.yml). The DNS records are CNAMEs to
    <uuid>.cfargotunnel.com. Get it with: cloudflared tunnel list
  EOT
  type        = string
  default     = ""
}

variable "mayo_api_tunnel_id" {
  description = <<-EOT
    UUID of the "mayo-api" named tunnel created by scripts/mayo-tunnel-run.sh.
    Get it with: cloudflared tunnel list
  EOT
  type        = string
  default     = ""
}