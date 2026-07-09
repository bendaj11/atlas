import { access } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { AtlasWorkspace } from "./workspace.js";

export function workspaceLabel(kind: AtlasWorkspace["kind"]): string {
  if (kind === "nx") return "an Nx workspace";
  if (kind === "turbo") return "a Turborepo workspace";
  if (kind === "workspace") return "a package-manager workspace";
  return "a standalone project";
}

export function displayTarget(workspaceRoot: string, root: string): string {
  const target = relative(workspaceRoot, root);
  return !target || target === "." ? "." : target.startsWith(`..${sep}`) || isAbsolute(target) ? root : target;
}

export function parseProjectPath(value: string): { name: string; segments: string[] } {
  const segments = value.split(/[\\/]/);
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid project name or path "${value}". Use a relative path with safe directory names.`);
  }
  segments.forEach((segment) => assertSafeId(segment, "project name or path segment"));
  return { name: segments.at(-1)!, segments };
}

export async function assertWritable(path: string, force: boolean, message: string): Promise<void> {
  if (force) return;
  try {
    await access(path);
    throw new Error(message);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

export function assertSafeId(value: string, subject: string): void {
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(value) || value === "." || value === "..") {
    throw new Error(`Invalid ${subject} "${value}". Use letters, numbers, dots, underscores, or hyphens.`);
  }
}

export function resolveContainedPath(root: string, path: string): string {
  const target = resolve(root, path);
  const relativePath = relative(resolve(root), target);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Generated path "${path}" escapes its target directory.`);
  }
  return target;
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
