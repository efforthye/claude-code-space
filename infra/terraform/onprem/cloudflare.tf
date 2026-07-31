# Cloudflare DNS on the efforthye.dev zone.
#
# SCOPE (deliberate): Terraform manages the DNS records only — NOT the named
# cloudflared tunnels themselves. The tunnels are created and owned by the
# shell agents (scripts/mayo-tunnel-run.sh and the richclub setup), and their
# credentials files live on the mini. Importing the tunnel resources would put
# Terraform in a position to rotate those secrets, which buys nothing and can
# take every service offline. The records below just point at the tunnel UUIDs.

locals {
  # Public hostname -> tunnel serving it. Each is a proxied CNAME to
  # <tunnel-uuid>.cfargotunnel.com, which is how cloudflared routes work.
  tunnel_hosts = {
    "richclub.efforthye.dev"        = var.richclub_tunnel_id
    "richclub-client.efforthye.dev" = var.richclub_tunnel_id
    "mayo-api.efforthye.dev"        = var.mayo_api_tunnel_id
  }
}

resource "cloudflare_dns_record" "tunnel" {
  for_each = local.tunnel_hosts

  zone_id = var.cloudflare_zone_id
  name    = each.key
  type    = "CNAME"
  content = "${each.value}.cfargotunnel.com"
  proxied = true
  ttl     = 1 # 1 = automatic; required by the provider even when proxied
}