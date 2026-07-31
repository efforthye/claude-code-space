terraform {
  required_version = ">= 1.5"

  # Local state. It lives on the mini next to this config and is NEVER committed
  # (see .gitignore) — Terraform state stores provider values in plaintext.
  # See wiki/decisions/0018-terraform-for-onprem-infra.md.
  backend "local" {}

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}