import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}
