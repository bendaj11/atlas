import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

const DEFAULT_BOOTSTRAP_TEMPLATE = 'atlas.bootstrap.html';

export interface BootstrapTemplateDependencies {
  readTemplate(path: string): Promise<string>;
}

const defaultDependencies: BootstrapTemplateDependencies = {
  readTemplate: async (path) => readFile(path, 'utf8'),
};

export async function loadBootstrapTemplate(
  projectRoot: string,
  configuredPath?: string,
  dependencies = defaultDependencies,
): Promise<string | undefined> {
  let templatePath = join(projectRoot, DEFAULT_BOOTSTRAP_TEMPLATE);

  if (configuredPath)
    templatePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(projectRoot, configuredPath);

  try {
    return await dependencies.readTemplate(templatePath);
  } catch (error) {
    if (!configuredPath && isFileNotFoundError(error)) return undefined;

    throw error;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
