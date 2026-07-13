import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const image = "atlas-host-server-verification:local";
const container = `atlas-host-server-verification-${process.pid}`;

await docker(["build", "-f", "tests/container/Containerfile", "-t", image, "."]);
try {
  await docker([
    "run", "--detach", "--read-only", "--tmpfs", "/tmp", "--name", container,
    "--publish", "127.0.0.1::8080",
    "--env", "ATLAS_HOST_ID=container-test-host",
    "--env", "ATLAS_CATALOG_URL=https://cdn.example/atlas/hosts/container-test-host/catalog.json",
    image
  ]);
  const user = (await docker(["inspect", "--format", "{{.Config.User}}", container])).trim();
  if (user !== "node") throw new Error(`Host-server container runs as unexpected user "${user}".`);
  const port = (await docker(["port", container, "8080/tcp"])).trim().match(/:(\d+)$/)?.[1];
  if (!port) throw new Error("Docker did not publish the host-server port.");
  const origin = `http://127.0.0.1:${port}`;
  await waitForHealth(`${origin}/health/ready`);
  const runtime = await fetch(`${origin}/atlas.runtime.json`).then(requireOk).then((response) => response.json());
  if (runtime.hostId !== "container-test-host") throw new Error("Container returned the wrong Atlas host runtime config.");
  await docker(["stop", "--time", "5", container]);
  const status = (await docker(["inspect", "--format", "{{.State.Status}}", container])).trim();
  if (status !== "exited") throw new Error(`Host-server container did not stop gracefully; status is "${status}".`);
  console.info("Verified host-server container build, non-root user, read-only filesystem, health, runtime config, and SIGTERM shutdown.");
} finally {
  await docker(["rm", "--force", container], true);
}

async function waitForHealth(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(url).then(requireOk);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

function requireOk(response) {
  if (!response.ok) throw new Error(`${response.url} returned HTTP ${response.status}.`);
  return response;
}

async function docker(args, ignoreFailure = false) {
  try {
    return (await execute("docker", args, { cwd: root })).stdout;
  } catch (error) {
    if (ignoreFailure) return "";
    throw error;
  }
}
