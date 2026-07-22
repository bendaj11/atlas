import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const artifacts = join(root, "tests/e2e/.artifacts");
const cdn = join(artifacts, "cdn");
const externalCdn = join(artifacts, "external-cdn");
const publishConfig = join(root, "tests/e2e/atlas.publish.ts");
const REACT_HOST_ID = "060a7f62-1c95-402c-9993-55749faf36d9";
const ANGULAR_HOST_ID = "399e1a5d-f83d-4248-96ed-e4211707ae1b";
const CATALOG_REACT_ID = "3ae54928-c2c6-491d-b766-6996ce0ef3c8";
const DASHBOARD_REACT_ID = "56e41bf1-d1b4-486f-a340-5782ee632bad";
const EXTERNAL_SHARED_UI_ID = "745518fc-3b1a-4197-b044-da306b0a02ff";
const projects = [
  "demo-react-host",
  "demo-angular-host",
  "orders-angular",
  "catalog-react",
  "dashboard-angular",
  "dashboard-react"
];

await rm(artifacts, { recursive: true, force: true });
await mkdir(cdn, { recursive: true });
await mkdir(externalCdn, { recursive: true });
await run("pnpm", ["run", "build"]);
if (process.env.ATLAS_E2E_REUSE_BUILD_OUTPUT !== "1") await run("pnpm", ["run", "build:examples"]);

for (const project of projects) {
  await run("node", [
    "packages/cli/dist/index.js", "publish", project,
    "--from-build-output",
    "--registry-base-url=http://127.0.0.1:4400",
    `--publish-config=${publishConfig}`
  ], publicationEnvironment({ ATLAS_CREATED_AT: "2026-01-01T00:00:00.000Z" }));
}

await addSecondCatalogRelease();
await createExternalWidgetRegistry();
await addVersionFixtures(DASHBOARD_REACT_ID);
await addBrokenRoute(REACT_HOST_ID, "49f9e422-c726-46ee-840b-ad33b8a8faa3");
await addBrokenRoute(ANGULAR_HOST_ID, "a7d07dd4-49c8-47cb-b020-e99b0b738587");
await buildBootstrap("demo-react-host", join(artifacts, "react-bootstrap"));
await buildBootstrap("demo-angular-host", join(artifacts, "angular-bootstrap"));

async function buildBootstrap(project, output) {
  await run("node", [
    "packages/cli/dist/index.js", "build-bootstrap", project,
    "--skip-compile",
    "--registry-base-url=http://127.0.0.1:4400",
    "--asset-origins=http://127.0.0.1:4400,http://127.0.0.1:4401",
    "--external-registry-urls=http://127.0.0.1:4401",
    `--out=${output}`
  ]);
}

async function addSecondCatalogRelease() {
  const entryPath = join(root, "examples/apps/catalog-react/dist/entry.js");
  const originalEntry = await readFile(entryPath, "utf8");
  const releaseEntry = originalEntry.replace("Catalog React", "Catalog React 0.2.0");
  if (releaseEntry === originalEntry) throw new Error("Could not mark the second catalog-react release.");
  await writeFile(entryPath, releaseEntry, "utf8");

  await run("node", [
    "packages/cli/dist/index.js", "publish", "catalog-react",
    "--skip-compile",
    "--registry-base-url=http://127.0.0.1:4400",
    `--publish-config=${publishConfig}`
  ], publicationEnvironment({
    ATLAS_CREATED_AT: "2026-01-02T00:00:00.000Z",
    CI_COMMIT_TAG: "v0.2.0"
  }));
}

async function createExternalWidgetRegistry() {
  const sourceRegistry = JSON.parse(await readFile(join(cdn, "registry.json"), "utf8"));
  const sourceManifests = sourceRegistry.apps.filter((manifest) => manifest.id === CATALOG_REACT_ID && manifest.channel === "production");
  const manifests = [];
  for (const source of sourceManifests) {
    const targetDirectory = join(externalCdn, "apps", EXTERNAL_SHARED_UI_ID, source.version, source.buildId);
    const sourceDirectory = dirname(join(cdn, new URL(source.remoteEntryUrl).pathname));
    await cp(sourceDirectory, targetDirectory, { recursive: true });
    manifests.push({
      ...source,
      id: EXTERNAL_SHARED_UI_ID,
      name: "External Shared UI",
      remoteEntryUrl: `http://127.0.0.1:4401/apps/${EXTERNAL_SHARED_UI_ID}/${source.version}/${source.buildId}/remoteEntry.json`,
      placements: [],
      supportedHosts: ["*"],
      externalAppsDependencies: undefined,
      exportedWidgets: (source.exportedWidgets ?? []).map((widget) => ({
        ...widget,
        id: "55ca3323-c62f-44de-9194-6ab42375e578",
        ownerAppId: EXTERNAL_SHARED_UI_ID,
        remoteEntryUrl: `http://127.0.0.1:4401/apps/${EXTERNAL_SHARED_UI_ID}/${source.version}/${source.buildId}/remoteEntry.json`
      }))
    });
  }
  const selected = manifests.find((manifest) => manifest.version === "0.1.0");
  if (!selected) throw new Error("External widget fixture requires catalog-react 0.1.0.");
  await writeJson(join(externalCdn, "registry.json"), {
    schemaVersion: "1",
    updatedAt: selected.createdAt,
    hosts: [],
    apps: manifests,
    selections: { hosts: {}, apps: { [EXTERNAL_SHARED_UI_ID]: { version: selected.version, buildId: selected.buildId } } }
  });
}

async function addVersionFixtures(appId) {
  const indexPath = join(cdn, "apps", appId, "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  const production = index.manifests[0];
  const historicalRemoteEntryUrl = await createDistinctArtifact(production.remoteEntryUrl, appId, "0.0.9", "historical-0.0.9", "Dashboard React Historical");
  const historical = {
    ...production,
    version: "0.0.9",
    buildId: "historical-0.0.9",
    channel: "production",
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
  const localRemoteEntryUrl = await createDistinctArtifact(production.remoteEntryUrl, appId, "0.2.0-local", "local-dev", "Dashboard React Local");
  await writeJson(join(cdn, "fixtures", `${appId}-local.json`), {
    ...production,
    version: "0.2.0-local",
    buildId: "local-dev",
    channel: "local",
    remoteEntryUrl: localRemoteEntryUrl,
    createdAt: "2026-01-03T00:00:00.000Z"
  });
}

async function createDistinctArtifact(sourceUrl, appId, version, buildId, heading) {
  const sourceDirectory = dirname(join(cdn, new URL(sourceUrl).pathname));
  const targetDirectory = join(cdn, "apps", appId, version, buildId);
  await cp(sourceDirectory, targetDirectory, { recursive: true });
  const entryPath = join(targetDirectory, "entry.js");
  const entry = await readFile(entryPath, "utf8");
  const markedEntry = entry.replace("Dashboard React", heading);
  if (markedEntry === entry) throw new Error(`Could not mark the ${version} ${appId} artifact.`);
  await writeFile(entryPath, markedEntry, "utf8");
  return `http://127.0.0.1:4400/apps/${appId}/${version}/${buildId}/remoteEntry.json`;
}

async function addBrokenRoute(hostId, brokenAppId) {
  const path = join(cdn, "hosts", hostId, "catalog.json");
  const catalog = JSON.parse(await readFile(path, "utf8"));
  const template = catalog.apps[0];
  catalog.apps.push({
    ...template,
    id: brokenAppId,
    name: "Broken Example",
    buildId: "missing",
    remoteEntryUrl: "http://127.0.0.1:4400/missing/remoteEntry.json",
    integrity: undefined,
    exportedWidgets: undefined,
    externalAppsDependencies: undefined,
    placements: [{
      id: `${brokenAppId}-route`,
      kind: "route",
      hostId,
      route: { basePath: "/broken", title: "Broken Example", nav: { label: "Broken", visible: true, order: 100 } }
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

function publicationEnvironment(environment = {}) {
  return { ATLAS_E2E_STORAGE: cdn, ...environment };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
