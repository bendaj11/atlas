import { access, readFile, writeFile } from 'node:fs/promises';

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function isMissingPathError(error: unknown): boolean {
  return (
    isNodeError(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

export async function readTextFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) return undefined;
    throw error;
  }
}

export async function readJsonFile<T>(path: string): Promise<T | undefined> {
  const source = await readTextFile(path);
  if (source === undefined) return undefined;
  try {
    return JSON.parse(source) as T;
  } catch (error) {
    throw new Error(`${path} is not valid JSON.`, { cause: error });
  }
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
