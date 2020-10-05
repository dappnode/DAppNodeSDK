import Docker from "dockerode";

let docker: Docker | null = null;

export function getDocker(): Docker {
  if (!docker) docker = new Docker({ socketPath: "/var/run/docker.sock" });
  return docker;
}
