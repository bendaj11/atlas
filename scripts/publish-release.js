import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execute } from "./process.js";

const root = resolve(import.meta.dirname, "..");
const releaseDirectory = join(root, "dist", "release");
const packageOrder = ["schema", "sdk", "runtime", "bootstrap", "generators", "testkit", "cli"];
const options = parseOptions(process.argv.slice(2));

if (!options.skipBuild) {
  await execute("pnpm", ["run", "release:bundle"], { cwd: root, stdio: "inherit" });
}

const release = JSON.parse(await readFile(join(releaseDirectory, "release.json"), "utf8"));
await verifyRelease(release);

for (const name of packageOrder) {
  const packageName = `@atlas/${name}`;
  if (!options.dryRun && await isPublished(packageName, release.version)) {
    console.info(`Skipping ${packageName}@${release.version}; version already exists.`);
    continue;
  }
  const archive = join(releaseDirectory, `${name}.tgz`);
  const args = ["publish", archive, "--no-git-checks", ...publishArguments(options)];
  await execute("pnpm", args, { cwd: root, stdio: "inherit" });
}

console.info(`${options.dryRun ? "Validated" : "Published"} Atlas ${release.version} package set.`);

function parseOptions(args) {
  const supportedValues = new Set(["registry", "tag", "access", "otp"]);
  const parsed = {
    dryRun: false,
    provenance: false,
    skipBuild: false,
    values: new Map()
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") parsed.dryRun = true;
    else if (argument === "--provenance") parsed.provenance = true;
    else if (argument === "--skip-build") parsed.skipBuild = true;
    else if (argument?.startsWith("--")) {
      const [name, inlineValue] = argument.slice(2).split("=", 2);
      if (!supportedValues.has(name)) throw new Error(`Unsupported release publish option --${name}.`);
      const value = inlineValue ?? args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Release publish option --${name} requires a value.`);
      parsed.values.set(name, value);
    } else {
      throw new Error(`Unexpected release publish argument "${argument}".`);
    }
  }
  const access = parsed.values.get("access");
  if (access && access !== "public" && access !== "restricted") {
    throw new Error('Release publish option --access must be "public" or "restricted".');
  }
  return parsed;
}

function publishArguments(parsed) {
  const args = [];
  for (const [name, value] of parsed.values) args.push(`--${name}`, value);
  if (parsed.dryRun) args.push("--dry-run");
  if (parsed.provenance) args.push("--provenance");
  return args;
}

async function isPublished(packageName, version) {
  const registry = options.values.get("registry");
  const args = ["view", `${packageName}@${version}`, "version", "--json"];
  if (registry) args.push("--registry", registry);
  try {
    const { stdout } = await execute("pnpm", args, { cwd: root });
    return JSON.parse(stdout) === version;
  } catch {
    return false;
  }
}

async function verifyRelease(release) {
  if (!release || release.schemaVersion !== "1" || typeof release.version !== "string") {
    throw new Error("Release manifest is invalid.");
  }
  const expectedFiles = packageOrder.map((name) => `${name}.tgz`);
  const artifacts = new Map((release.artifacts ?? []).map((artifact) => [artifact.file, artifact.sha256]));
  if (artifacts.size !== expectedFiles.length || expectedFiles.some((file) => !artifacts.has(file))) {
    throw new Error("Release manifest does not contain the complete Atlas package set.");
  }
  for (const file of expectedFiles) {
    const contents = await readFile(join(releaseDirectory, file));
    const digest = createHash("sha256").update(contents).digest("hex");
    if (digest !== artifacts.get(file)) throw new Error(`Release checksum failed for ${file}.`);
  }
}
