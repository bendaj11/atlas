import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../workspace/service/workspace.js';
import { defaultDevServerPort } from '../workspace/service/workspace.js';

type ProjectType = 'host' | 'app';

const MAX_TCP_PORT = 65_535;
const VITE_PORT = /server\s*:\s*\{[^}]*\bport\s*:\s*(\d+)/;

export async function suggestedDevServerPort(
  workspace: AtlasWorkspace,
  type: ProjectType,
): Promise<number> {
  const ports = await configuredDevServerPorts(await workspace.listProjects());
  const startingPort = defaultDevServerPort(type);
  for (let port = startingPort; port <= MAX_TCP_PORT; port += 1) {
    if (!ports.has(port)) return port;
  }
  throw new Error(`No available dev-server ports remain from ${startingPort}.`);
}

async function configuredDevServerPorts(
  projects: readonly AtlasProject[],
): Promise<Set<number>> {
  const portGroups = await Promise.all(projects.map(projectDevServerPorts));
  return new Set(portGroups.flat());
}

async function projectDevServerPorts(project: AtlasProject): Promise<number[]> {
  const [angularPorts, nxPorts, vitePorts] = await Promise.all([
    jsonDevServerPorts(join(project.root, 'angular.json'), 'projects'),
    jsonDevServerPorts(join(project.root, 'project.json'), 'targets'),
    viteDevServerPorts(join(project.root, 'vite.config.ts')),
  ]);
  return [...angularPorts, ...nxPorts, ...vitePorts];
}

async function jsonDevServerPorts(
  path: string,
  container: 'projects' | 'targets',
): Promise<number[]> {
  const config = await readJson(path);
  if (!config) return [];
  const projects =
    container === 'projects' ? recordValues(config.projects) : [config];
  return projects.flatMap((project) => targetPorts(project));
}

async function viteDevServerPorts(path: string): Promise<number[]> {
  const source = await readText(path);
  const match = source?.match(VITE_PORT);
  return match ? validPort(match[1]) : [];
}

function targetPorts(project: Record<string, unknown>): number[] {
  const targets = recordValues(project.architect ?? project.targets);
  return targets.flatMap((target) => validPort(asRecord(target.options).port));
}

async function readJson(
  path: string,
): Promise<Record<string, unknown> | undefined> {
  const source = await readText(path);
  if (!source) return undefined;
  try {
    return asRecord(JSON.parse(source));
  } catch {
    return undefined;
  }
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordValues(value: unknown): Record<string, unknown>[] {
  return Object.values(asRecord(value)).map(asRecord);
}

function validPort(value: unknown): number[] {
  const port =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : undefined;
  return isValidTcpPort(port) ? [port] : [];
}

function isValidTcpPort(port: unknown): port is number {
  return (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= MAX_TCP_PORT
  );
}
