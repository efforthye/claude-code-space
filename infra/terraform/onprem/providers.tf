provider "docker" {
  host = var.docker_host
}

provider "cloudflare" {
  # Prefer the CLOUDFLARE_API_TOKEN environment variable; the variable exists so
  # the value can also come from a gitignored terraform.tfvars if needed.
  api_token = var.cloudflare_api_token != "" ? var.cloudflare_api_token : null
}