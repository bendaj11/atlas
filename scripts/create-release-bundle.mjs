import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageDirectory = join(root, "packages/schema");
const verifiedPackagesDirectory = join(root, "dist/package-verification");
const releaseDirectory = join(root, "dist/release");
const expectedArchives = ["cli.tgz", "generators.tgz", "runtime.tgz", "schema.tgz", "sdk.tgz", "testkit.tgz"];
const packageManifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
const version = packageManifest.version;

validateReleaseTag(version);
await rm(releaseDirectory, { recursive: true, force: true });
await mkdir(releaseDirectory, { recursive: true });

const archives = (await readdir(verifiedPackagesDirectory))
  .filter((file) => file.endsWith(".tgz"))
  .sort();

if (archives.join("\n") !== expectedArchives.join("\n")) {
  throw new Error(`Release bundle contains unexpected package archives: ${archives.join(", ")}.`);
}

const artifacts = [];
for (const archive of archives) {
  const source = join(verifiedPackagesDirectory, archive);
  const destination = join(releaseDirectory, archive);
  await copyFile(source, destination);
  artifacts.push({ file: archive, sha256: await sha256(destination) });
}

await writeFile(
  join(releaseDirectory, "SHA256SUMS"),
  `${artifacts.map(({ file, sha256: digest }) => `${digest}  ${file}`).join("\n")}\n`,
  "utf8"
);
await writeFile(
  join(releaseDirectory, "release.json"),
  `${JSON.stringify({ schemaVersion: "1", version, artifacts }, null, 2)}\n`,
  "utf8"
);

console.info(`Created Atlas ${version} release bundle with ${artifacts.length} verified packages.`);

function validateReleaseTag(releaseVersion) {
  const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
  if (tag && tag !== `v${releaseVersion}`) {
    throw new Error(`Release tag ${tag} does not match package version ${releaseVersion}.`);
  }
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}
