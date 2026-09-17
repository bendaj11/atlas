import { join } from 'node:path';
import {
  type AtlasProject,
  type AtlasWorkspace,
  defaultDevServerPort,
} from '../../workspace/index.js';
import { readTextFile, recordOrEmpty } from '../../shared/index.js';

type ProjectType = 'host' | 'app';

const MAX_TCP_PORT = 65_535;
const VITE_PORT = /server\s*:\s*\{[^}]*\bport\s*:\s*(\d+)/;

export async function suggestDevServerPort(
  workspace: AtlasWorkspace,
  type: ProjectType,
): Promise<number> {
  const ports = await listConfiguredDevServerPorts(
    await workspace.listProjects(),
  );
  const startingPort = defaultDevServerPort(type);
  for (let port = startingPort; port <= MAX_TCP_PORT; port += 1) {
    if (!ports.has(port)) return port;
  }

  throw new Error(`No available dev-server ports remain from ${startingPort}.`);
}

async function listConfiguredDevServerPorts(
  projects: readonly AtlasProject[],
): Promise<Set<number>> {
  const portGroups = await Promise.all(projects.map(listProjectDevServerPorts));

  return new Set(portGroups.flat());
}

async function listProjectDevServerPorts(
  project: AtlasProject,
): Promise<number[]> {
  const [angularPorts, nxPorts, vitePorts] = await Promise.all([
    listJsonDevServerPorts(join(project.root, 'angular.json'), 'projects'),
    listJsonDevServerPorts(join(project.root, 'project.json'), 'targets'),
    listViteDevServerPorts(join(project.root, 'vite.config.ts')),
  ]);

  return [...angularPorts, ...nxPorts, ...vitePorts];
}

async function listJsonDevServerPorts(
  path: string,
  container: 'projects' | 'targets',
): Promise<number[]> {
  const config = await readJsonRecord(path);

  if (!config) return [];
  const projects =
    container === 'projects' ? listNestedRecords(config.projects) : [config];
  return projects.flatMap((project) => listNxTargetPorts(project));
}

async function listViteDevServerPorts(path: string): Promise<number[]> {
  const source = await readTextFile(path);
  const match = source?.match(VITE_PORT);

  return match ? parseValidPorts(match[1]) : [];
}

function listNxTargetPorts(project: Record<string, unknown>): number[] {
  const targets = listNestedRecords(project.architect ?? project.targets);

  return targets.flatMap((target) =>
    parseValidPorts(recordOrEmpty(target.options).port),
  );
}

async function readJsonRecord(
  path: string,
): Promise<Record<string, unknown> | undefined> {
  const source = await readTextFile(path);

  if (!source) return undefined;

  try {
    return recordOrEmpty(JSON.parse(source));
  } catch {
    return undefined;
  }
}

function listNestedRecords(value: unknown): Record<string, unknown>[] {
  return Object.values(recordOrEmpty(value)).map(recordOrEmpty);
}

function parseValidPorts(value: unknown): number[] {
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
