import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageDirectories = ["schema", "sdk", "runtime", "generators", "testkit", "cli"];

export async function createReleaseWorkspace(version: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "atlas-release-"));
  await writeJson(join(root, "package.json"), { name: "atlas-platform", version });
  for (const directory of packageDirectories) {
    await writeJson(join(root, "packages", directory, "package.json"), {
      name: `@atlas/${directory}`,
      version,
      dependencies: { "@atlas/schema": version }
    });
  }
  await writeJson(join(root, "apps/columbus/package.json"), { version });
  await writeJson(join(root, "apps/columbus/src/manifest.json"), { version });
  const generatorPath = join(root, "packages/generators/src/cli/generator-versions.ts");
  await mkdir(join(generatorPath, ".."), { recursive: true });
  await writeFile(generatorPath, `export const ATLAS_PACKAGE_VERSION = "${version}";\n`);
  return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}
