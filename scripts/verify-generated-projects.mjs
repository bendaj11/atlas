import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const artifacts = join(root, "dist/package-verification");
const cleanRoom = join(root, "dist/generated-project-verification");
const atlasPackages = ["contracts", "sdk", "runtime", "generators", "testkit", "cli"];
const projects = [
  { type: "host", name: "clean-react-host", framework: "react" },
  { type: "app", name: "clean-react-mf", framework: "react" },
  { type: "host", name: "clean-angular-host", framework: "angular" },
  { type: "app", name: "clean-angular-mf", framework: "angular" }
];
const expectedVersion = JSON.parse(await readFile(join(root, "packages/contracts/package.json"), "utf8")).version;

await rm(cleanRoom, { recursive: true, force: true });
await mkdir(join(cleanRoom, "tooling"), { recursive: true });
const localPackages = await stagePackageArchives();
await writeJson(join(cleanRoom, "tooling/package.json"), toolingManifest(localPackages));
await writeFile(join(cleanRoom, "tooling/yarn.lock"), "", "utf8");
await runYarn(["install", "--non-interactive"], join(cleanRoom, "tooling"));

for (const project of projects) {
  await runAtlas(["g", project.type, project.name, `--framework=${project.framework}`, `--directory=${join(cleanRoom, "projects", project.name)}`]);
}

await assertGeneratedAtlasRanges();
for (const project of projects) await installAndBuildProject(project, localPackages);

console.info(`Built ${projects.length} clean-room projects from packed Atlas packages.`);

async function stagePackageArchives() {
  const packageDirectory = join(cleanRoom, "packages");
  await mkdir(packageDirectory, { recursive: true });
  const entries = await Promise.all(atlasPackages.map(async (name) => {
    const source = join(artifacts, `${name}.tgz`);
    const contents = await readFile(source);
    const digest = createHash("sha256").update(contents).digest("hex").slice(0, 12);
    const destination = join(packageDirectory, `${name}-${digest}.tgz`);
    await copyFile(source, destination);
    return [`@atlas/${name}`, `file:${destination}`];
  }));
  return Object.fromEntries(entries);
}

function toolingManifest(localPackages) {
  return {
    name: "atlas-generation-tooling",
    private: true,
    packageManager: "yarn@1.22.11",
    dependencies: localPackages,
    resolutions: localPackages
  };
}

async function assertGeneratedAtlasRanges() {
  for (const project of projects) {
    const manifest = JSON.parse(await readFile(join(cleanRoom, "projects", project.name, "package.json"), "utf8"));
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      if (name.startsWith("@atlas/") && version !== `^${expectedVersion}`) {
        throw new Error(`${project.name} generated an unstable Atlas dependency ${name}@${version}.`);
      }
    }
  }
}

async function runAtlas(args) {
  await run(join(cleanRoom, "tooling/node_modules/.bin/atlas"), args, cleanRoom);
}

async function runYarn(args, cwd) {
  await run("yarn", args, cwd);
}

async function installAndBuildProject(project, localPackages) {
  const projectRoot = join(cleanRoom, "projects", project.name);
  const manifestPath = join(projectRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const dependencyGroup of [manifest.dependencies, manifest.devDependencies]) {
    for (const name of Object.keys(dependencyGroup ?? {})) {
      if (name.startsWith("@atlas/")) dependencyGroup[name] = localPackages[name];
    }
  }
  manifest.resolutions = localPackages;
  await writeJson(manifestPath, manifest);
  await writeFile(join(projectRoot, "yarn.lock"), "", "utf8");
  await runYarn(["install", "--non-interactive"], projectRoot);
  await runYarn(["build"], projectRoot);
}

async function run(command, args, cwd) {
  const environment = { ...process.env, PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH ?? ""}` };
  const { stdout, stderr } = await execute(command, args, { cwd, env: environment, maxBuffer: 20 * 1024 * 1024 });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
