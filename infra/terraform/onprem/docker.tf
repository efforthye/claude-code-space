# Docker containers running on the home-server mini.
#
# Every value here was read off the running containers on 2026-08-01 — first
# with scripts/tf-discover.sh, then cross-checked against
# `terraform plan -generate-config-out`, which writes the config Terraform
# itself derives from the imported state. Nothing below is inferred.
#
# mayo-api is deliberately absent: it runs as a launchd uvicorn process, not a
# container (see the deploy-mayo-api runbook).
#
# THREE THINGS THAT LOOK ODD AND ARE NOT
#
# 1. `image` is the TAG, not the sha256 id. Import records whatever the
#    container was created with, which is the tag. Pointing this at
#    data.docker_image.<x>.id resolves to a digest and forces replacement of
#    all three containers — the first draft did exactly that.
#
# 2. Two `ports` blocks per published port. Docker binds each one on both
#    0.0.0.0 and ::, so the imported state holds two entries; one block per
#    port reads as "delete the other" and forces replacement.
#
# 3. `volumes` is declared but ignored. The kreuzwerker provider does NOT
#    populate volumes on import — generate-config-out emits none at all, even
#    for Jenkins, which has two. Declaring them therefore reads as an addition
#    and forces replacement. ignore_changes keeps Terraform from acting on the
#    difference while the blocks stay here as the written record, and a
#    from-scratch create would still get the mounts right (ignore_changes
#    applies to updates, not creation).

resource "docker_container" "richclub_api" {
  name         = "richclub-api"
  image        = "efforthye/richclub-api:latest"
  restart      = "unless-stopped"
  network_mode = "bridge"

  entrypoint = []
  command    = ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

  ports {
    internal = 8000
    external = 8000
    ip       = "0.0.0.0"
    protocol = "tcp"
  }
  ports {
    internal = 8000
    external = 8000
    ip       = "::"
    protocol = "tcp"
  }

  # Model weights and collected data live on the host so they survive a rebuild.
  volumes {
    host_path      = "/Users/nadeko/models"
    container_path = "/app/models"
  }
  volumes {
    host_path      = "/Users/nadeko/collect_data"
    container_path = "/app/collect_data"
  }

  # env holds MongoDB credentials, a JWT secret, SMTP and Telegram tokens.
  # Terraform must neither manage nor diff them: they stay where the deploy
  # puts them and never enter state or this repo.
  lifecycle {
    ignore_changes = [env, volumes]
  }
}

resource "docker_container" "richclub_front" {
  name         = "richclub-front"
  image        = "efforthye/richclub-front:latest"
  restart      = "unless-stopped"
  network_mode = "bridge"

  entrypoint = ["/docker-entrypoint.sh"]
  command    = ["nginx", "-g", "daemon off;"]

  ports {
    internal = 80
    external = 3000
    ip       = "0.0.0.0"
    protocol = "tcp"
  }
  ports {
    internal = 80
    external = 3000
    ip       = "::"
    protocol = "tcp"
  }

  lifecycle {
    ignore_changes = [env, volumes]
  }
}

resource "docker_container" "jenkins" {
  name         = "jenkins"
  image        = "jenkins/jenkins:lts-jdk17"
  restart      = "unless-stopped"
  network_mode = "bridge"

  entrypoint = ["/usr/bin/tini", "--", "/usr/local/bin/jenkins.sh"]
  command    = []

  ports {
    internal = 8080
    external = 9090
    ip       = "0.0.0.0"
    protocol = "tcp"
  }
  ports {
    internal = 8080
    external = 9090
    ip       = "::"
    protocol = "tcp"
  }
  ports {
    internal = 50000
    external = 50000
    ip       = "0.0.0.0"
    protocol = "tcp"
  }
  ports {
    internal = 50000
    external = 50000
    ip       = "::"
    protocol = "tcp"
  }

  # Every job, plugin, credential and piece of configuration Jenkins has.
  volumes {
    container_path = "/var/jenkins_home"
    volume_name    = "jenkins_home"
  }

  # The host Docker socket — how Jenkins builds and deploys the richclub
  # images. Stated plainly: a container holding this socket has root-equivalent
  # control of Docker on the mini, so anything able to run a Jenkins job can run
  # anything on the host. It is here because the current CI design needs it,
  # not because it is safe.
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
  }

  lifecycle {
    ignore_changes = [env, volumes]

    # Recreating this container detaches jenkins_home and takes CI with it.
    # Any change that would replace it should be a deliberate, manual act —
    # remove this line, do it, put it back.
    prevent_destroy = true
  }
}
