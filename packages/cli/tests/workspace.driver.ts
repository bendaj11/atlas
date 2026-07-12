import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createWorkspaceFixture(prefix: string, files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, contents);
  }
  return root;
}
