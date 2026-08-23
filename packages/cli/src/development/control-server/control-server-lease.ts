import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AtlasDevOverrideDocument } from '../types.js';
import { CONTROL_RECONCILIATION_INTERVAL_MS } from '../constants.js';

const LEASE_DIRECTORY = join(tmpdir(), 'atlas-dev-control-server-leases');
const LEASE_LIFETIME_MS = CONTROL_RECONCILIATION_INTERVAL_MS * 3;

interface ControlServerLease {
  document: AtlasDevOverrideDocument;
  processId: number;
  ready: boolean;
  renewedAt: number;
}

export async function writeControlServerLease(options: {
  port: number;
  document: AtlasDevOverrideDocument;
  ready: boolean;
}): Promise<void> {
  if (options.port === 0) return;
  await mkdir(LEASE_DIRECTORY, { recursive: true });
  await writeFile(
    leasePath(options.port, options.document),
    JSON.stringify({
      document: options.document,
      processId: process.pid,
      ready: options.ready,
      renewedAt: Date.now(),
    } satisfies ControlServerLease),
  );
}

export async function readActiveControlServerLeases(
  port: number,
): Promise<ControlServerLease[]> {
  if (port === 0) return [];
  const paths = await readdir(LEASE_DIRECTORY).catch(() => [] as string[]);
  const leases = await Promise.all(
    paths
      .filter((path) => path.startsWith(`${port}-`))
      .map(async (path) => readLease(join(LEASE_DIRECTORY, path))),
  );
  return leases.flatMap((lease) => (lease ? [lease] : []));
}

export async function removeControlServerLease(options: {
  port: number;
  document: AtlasDevOverrideDocument;
}): Promise<void> {
  if (options.port === 0) return;
  await rm(leasePath(options.port, options.document), { force: true });
}

function leasePath(port: number, document: AtlasDevOverrideDocument): string {
  return join(LEASE_DIRECTORY, `${port}-${leaseId(document)}.json`);
}

function leaseId(document: AtlasDevOverrideDocument): string {
  const appIds = document.overrides
    .map((override) => override.appId)
    .sort()
    .join('-');
  const artifactKey = document.hostOverride ? 'host' : `apps-${appIds}`;
  return encodeURIComponent(`${document.hostId}-${artifactKey}`);
}

async function readLease(
  path: string,
): Promise<ControlServerLease | undefined> {
  try {
    const lease = JSON.parse(
      await readFile(path, 'utf8'),
    ) as ControlServerLease;
    if (!isActiveLease(lease)) {
      await rm(path, { force: true });
      return undefined;
    }
    return lease;
  } catch {
    return undefined;
  }
}

function isActiveLease(lease: ControlServerLease): boolean {
  return (
    typeof lease === 'object' &&
    lease !== null &&
    typeof lease.renewedAt === 'number' &&
    Date.now() - lease.renewedAt < LEASE_LIFETIME_MS &&
    typeof lease.processId === 'number' &&
    processExists(lease.processId) &&
    typeof lease.ready === 'boolean' &&
    typeof lease.document === 'object' &&
    lease.document !== null
  );
}

function processExists(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}
