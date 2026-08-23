import { readFile } from 'node:fs/promises';

interface ColumbusManifest {
  manifest_version: number;
  minimum_chrome_version: string;
  permissions: string[];
  host_permissions: string[];
  content_scripts: Array<{
    run_at: string;
    world?: string;
    matches: string[];
    js: string[];
  }>;
  action: { default_popup: string; default_icon: Record<string, string> };
  icons: Record<string, string>;
  background: { service_worker: string };
}

export class ColumbusBuildDriver {
  private manifest: ColumbusManifest | undefined;

  readonly when = {
    manifestRead: async (): Promise<this> => {
      this.manifest = await readColumbusManifest();
      return this;
    },
  };

  readonly get = {
    manifest: (): ColumbusManifest => {
      if (!this.manifest) throw new Error('Manifest was not read.');
      return this.manifest;
    },
  };
}

async function readColumbusFile(path: string): Promise<string> {
  return readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

async function readColumbusManifest(): Promise<ColumbusManifest> {
  const value: unknown = JSON.parse(
    await readColumbusFile('dist/manifest.json'),
  );
  if (!isColumbusManifest(value)) {
    throw new Error('Columbus build manifest has an invalid shape.');
  }
  return value;
}

function isColumbusManifest(value: unknown): value is ColumbusManifest {
  return (
    isRecord(value) &&
    typeof value.manifest_version === 'number' &&
    typeof value.minimum_chrome_version === 'string' &&
    Array.isArray(value.permissions) &&
    Array.isArray(value.host_permissions) &&
    Array.isArray(value.content_scripts) &&
    isRecord(value.action) &&
    isRecord(value.icons) &&
    isRecord(value.background)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
