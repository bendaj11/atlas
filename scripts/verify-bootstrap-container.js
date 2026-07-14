import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const image = "atlas-bootstrap-verification:local";
const container = `atlas-bootstrap-verification-${process.pid}`;

await execute(process.execPath, [
  "packages/cli/dist/index.js", "build-bootstrap", "demo-react-host", "--skip-compile",
  "--registry-base-url=https://cdn.example/atlas", "--out=dist/container-bootstrap"
], { cwd: root });
await docker(["build", "-f", "tests/container/Containerfile", "-t", image, "."]);
try {
  await docker([
    "run", "--detach", "--read-only", "--tmpfs", "/tmp", "--name", container,
    "--publish", "127.0.0.1::8080", image
  ]);
  const user = (await docker(["inspect", "--format", "{{.Config.User}}", container])).trim();
  if (!user) throw new Error("Bootstrap container must run as a non-root image user.");
  const port = (await docker(["port", container, "8080/tcp"])).trim().match(/:(\d+)$/)?.[1];
  if (!port) throw new Error("Docker did not publish bootstrap port.");
  const origin = `http://127.0.0.1:${port}`;
  await waitForHealth(`${origin}/health/live`);
  const runtime = await fetch(`${origin}/atlas.runtime.json`).then(requireOk).then((response) => response.json());
  if (runtime.hostId !== "060a7f62-1c95-402c-9993-55749faf36d9") throw new Error("Container returned wrong Atlas host runtime config.");
  const deepLink = await fetch(`${origin}/orders/42`).then(requireOk).then((response) => response.text());
  if (!deepLink.includes("atlas-host-root")) throw new Error("Container did not apply SPA fallback.");
  const missingAsset = await fetch(`${origin}/missing.js`);
  if (missingAsset.status !== 404) throw new Error(`Missing asset returned HTTP ${missingAsset.status}; expected 404.`);
  console.info("Verified static bootstrap container, non-root user, read-only filesystem, health, runtime, SPA fallback, and asset 404 behavior.");
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
