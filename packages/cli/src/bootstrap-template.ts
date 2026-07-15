import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const DEFAULT_BOOTSTRAP_TEMPLATE = "atlas.bootstrap.html";

export async function loadBootstrapTemplate(projectRoot: string, configuredPath?: string): Promise<string | undefined> {
  let templatePath = join(projectRoot, DEFAULT_BOOTSTRAP_TEMPLATE);
  if (configuredPath) templatePath = isAbsolute(configuredPath) ? configuredPath : resolve(projectRoot, configuredPath);
  try {
    return await readFile(templatePath, "utf8");
  } catch (error) {
    if (!configuredPath && isFileNotFoundError(error)) return undefined;
    throw error;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
