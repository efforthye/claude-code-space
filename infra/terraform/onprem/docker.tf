# Docker containers running on the home-server mini.
#
# IMPORTANT — these definitions were written from the wiki snapshot in
# wiki/infra/home-server.md (names, images, published ports). Volumes, env keys,
# networks and restart policies are NOT in that snapshot, so they must be
# reconciled against reality before the first apply:
#
#   scripts/tf-discover.sh        # run on the mini; dumps real state to raw/
#
# Until `terraform plan` reports no destructive changes, treat this file as a
# draft. See infra/terraform/README.md for the import-first procedure.

data "docker_image" "richclub_api" {
  name = "efforthye/richclub-api:latest"
}

data "docker_image" "richclub_front" {
  name = "efforthye/richclub-front:latest"
}

data "docker_image" "jenkins" {
  name = "jenkins/jenkins:lts-jdk17"
}

resource "docker_container" "richclub_api" {
  name  = "richclub-api"
  image = data.docker_image.richclub_api.id

  restart = "unless-stopped"

  ports {
    internal = 8000
    external = 8000
  }

  # Env values are deliberately absent — they hold richclub's credentials and
  # must never be written here. Set them on the host (.env / Jenkins) and add
  # `lifecycle { ignore_changes = [env] }` if Terraform starts fighting over
  # them after import.
  lifecycle {
    ignore_changes = [env]
  }
}

resource "docker_container" "richclub_front" {
  name  = "richclub-front"
  image = data.docker_image.richclub_front.id

  restart = "unless-stopped"

  ports {
    internal = 80
    external = 3000
  }

  lifecycle {
    ignore_changes = [env]
  }
}

resource "docker_container" "jenkins" {
  name  = "jenkins"
  image = data.docker_image.jenkins.id

  restart = "unless-stopped"

  ports {
    internal = 8080
    external = 9090
  }

  ports {
    internal = 50000
    external = 50000
  }

  # Jenkins keeps all of its configuration, jobs and credentials in a volume.
  # The real mount must be confirmed by tf-discover.sh before apply — a wrong
  # guess here would recreate the container and orphan the CI state.
  volumes {
    container_path = "/var/jenkins_home"
    volume_name    = "jenkins_home"
  }

  lifecycle {
    ignore_changes = [env]
  }
}