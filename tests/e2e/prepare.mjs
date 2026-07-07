import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const artifacts = join(root, "tests/e2e/.artifacts");
const cdn = join(artifacts, "cdn");
const registrySnapshot = join(cdn, "registry.json");
const microfrontends = ["orders-angular", "catalog-react", "dashboard-angular", "dashboard-react"];

await rm(artifacts, { recursive: true, force: true });
await mkdir(cdn, { recursive: true });
await writeJson(registrySnapshot, { schemaVersion: "1", updatedAt: "1970-01-01T00:00:00.000Z", manifests: [] });
await run("yarn", ["build"]);

for (const id of microfrontends) {
  const publication = join(artifacts, "publications", id);
  await run("node", [
    "packages/cli/dist/index.js", "build", id,
    "--version=0.1.0",
    "--registry-base-url=http://127.0.0.1:4400",
    `--registry-snapshot=${registrySnapshot}`,
    `--publication-directory=${publication}`,
    `--publication-plan=${publication}.json`
  ], { ATLAS_CREATED_AT: "2026-01-01T00:00:00.000Z" });
  await cp(publication, cdn, { recursive: true, force: true });
}

await addSecondCatalogRelease();
await addVersionFixtures("dashboard-react");
await addBrokenRoute("demo-react-host");
await addBrokenRoute("demo-angular-host");
await run("yarn", ["workspace", "@atlas-example/demo-react-host", "build"]);
await run("yarn", ["workspace", "@atlas-example/demo-angular-host", "build"]);

async function addSecondCatalogRelease() {
  const entryPath = join(root, "examples/mfs/catalog-react/dist/entry.js");
  const originalEntry = await readFile(entryPath, "utf8");
  const releaseEntry = originalEntry.replace("Catalog React", "Catalog React 0.2.0");
  if (releaseEntry === originalEntry) throw new Error("Could not mark the second catalog-react release.");
  await writeFile(entryPath, releaseEntry, "utf8");

  const publication = join(artifacts, "publications", "catalog-react-0.2.0");
  await run("node", [
    "packages/cli/dist/index.js", "build", "catalog-react",
    "--skip-compile",
    "--version=0.2.0",
    "--build-id=release-0.2.0",
    "--registry-base-url=http://127.0.0.1:4400",
    `--registry-snapshot=${registrySnapshot}`,
    `--publication-directory=${publication}`,
    `--publication-plan=${publication}.json`
  ], { ATLAS_CREATED_AT: "2026-01-02T00:00:00.000Z" });
  await cp(publication, cdn, { recursive: true, force: true });
}

async function addVersionFixtures(mfId) {
  const indexPath = join(cdn, "microfrontends", mfId, "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  const production = index.manifests[0];
  const historicalRemoteEntryUrl = await createDistinctArtifact(production.remoteEntryUrl, mfId, "0.0.9", "historical-0.0.9", "Dashboard React Historical");
  const historical = {
    ...production,
    version: "0.0.9",
    buildId: "historical-0.0.9",
    channel: "historical",
    remoteEntryUrl: historicalRemoteEntryUrl,
    createdAt: "2025-12-01T00:00:00.000Z"
  };
  const pullRequest = {
    ...production,
    version: "0.2.0-pr.42",
    buildId: "pr-42",
    channel: "pr",
    prNumber: 42,
    createdAt: "2026-01-02T00:00:00.000Z"
  };
  index.manifests.push(pullRequest, historical);
  await writeJson(indexPath, index);
  const localRemoteEntryUrl = await createDistinctArtifact(production.remoteEntryUrl, mfId, "0.2.0-local", "local-dev", "Dashboard React Local");
  await writeJson(join(cdn, "fixtures", `${mfId}-local.json`), {
    ...production,
    version: "0.2.0-local",
    buildId: "local-dev",
    channel: "local",
    remoteEntryUrl: localRemoteEntryUrl,
    createdAt: "2026-01-03T00:00:00.000Z"
  });
}

async function createDistinctArtifact(sourceUrl, mfId, version, buildId, heading) {
  const sourceDirectory = dirname(join(cdn, new URL(sourceUrl).pathname));
  const targetDirectory = join(cdn, mfId, version, buildId);
  await cp(sourceDirectory, targetDirectory, { recursive: true });
  const entryPath = join(targetDirectory, "entry.js");
  const entry = await readFile(entryPath, "utf8");
  const markedEntry = entry.replace("Dashboard React", heading);
  if (markedEntry === entry) throw new Error(`Could not mark the ${version} ${mfId} artifact.`);
  await writeFile(entryPath, markedEntry, "utf8");
  return `http://127.0.0.1:4400/${mfId}/${version}/${buildId}/remoteEntry.json`;
}

async function addBrokenRoute(hostId) {
  const path = join(cdn, "hosts", hostId, "catalog.json");
  const catalog = JSON.parse(await readFile(path, "utf8"));
  const template = catalog.manifests[0];
  catalog.manifests.push({
    ...template,
    id: `broken-${hostId}`,
    name: "Broken Example",
    buildId: "missing",
    remoteEntryUrl: "http://127.0.0.1:4400/missing/remoteEntry.json",
    integrity: undefined,
    exportedComponents: undefined,
    uses: undefined,
    placements: [{
      id: `broken-${hostId}-route`,
      kind: "route",
      hostId,
      route: { id: "broken", basePath: "/broken", title: "Broken Example", nav: { label: "Broken", visible: true, order: 100 } }
    }]
  });
  await writeJson(path, catalog);
}

async function run(command, args, environment = {}) {
  await new Promise((resolvePromise, reject) => {
    const binPath = join(root, "node_modules/.bin");
    const path = [binPath, process.env.PATH].filter(Boolean).join(delimiter);
    const env = { ...process.env, NG_BUILD_MAX_WORKERS: "1", PATH: path, ...environment };
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`)));
  });
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
