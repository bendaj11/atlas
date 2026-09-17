import type {
  S3Options,
  S3PublicationLockMode,
} from '../s3-storage/s3-storage.js';
import type { CliArguments } from '../../shared/index.js';

export type StorageBackendSelection =
  { provider: 'artifactory' } | { provider: 's3'; s3Options: S3Options };

export function selectStorageFromEnvironment(
  args: CliArguments | undefined,
): StorageBackendSelection | undefined {
  const provider = args?.flag('storage') ?? process.env.ATLAS_STORAGE;
  if (provider === 'artifactory') return { provider };
  const bucket = args?.flag('bucket') ?? process.env.ATLAS_S3_BUCKET;
  if (!provider && !bucket) return undefined;

  if (provider && provider !== 's3')
    throw new Error(
      `Unsupported storage provider "${provider}". Use s3 or artifactory.`,
    );
  if (!bucket)
    throw new Error('ATLAS_S3_BUCKET is required when ATLAS_STORAGE=s3.');

  return { provider: 's3', s3Options: s3OptionsFromEnvironment(args, bucket) };
}

export function requiredStorageValue(options: {
  args?: CliArguments;
  flag?: string;
  environmentName: string;
}): string {
  const { args, flag, environmentName } = options;
  const value =
    (flag ? args?.flag(flag) : undefined) ?? process.env[environmentName];
  if (!value?.trim()) {
    throw new Error(
      `${environmentName}${flag ? ` (or --${flag})` : ''} is required for Artifactory storage.`,
    );
  }

  return value;
}

export function positiveEnvironmentInteger(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }

  return number;
}

function s3OptionsFromEnvironment(
  args: CliArguments | undefined,
  bucket: string,
): S3Options {
  const accessKeyId = process.env.ATLAS_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      'ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together.',
    );
  }
  const endpoint =
    args?.flag('storage-api-url') ?? process.env.ATLAS_STORAGE_API_URL;
  const prefix =
    args?.flag('key-prefix') ?? process.env.ATLAS_STORAGE_KEY_PREFIX;

  return {
    bucket,
    ...(endpoint ? { endpoint } : {}),
    ...(prefix ? { prefix } : {}),
    region:
      args?.flag('region') ??
      process.env.ATLAS_S3_REGION ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      'us-east-1',
    forcePathStyle: environmentBoolean('ATLAS_S3_FORCE_PATH_STYLE'),
    lockMode: environmentS3LockMode(),
    ...(accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
          ...(process.env.ATLAS_STORAGE_SESSION_TOKEN
            ? { sessionToken: process.env.ATLAS_STORAGE_SESSION_TOKEN }
            : {}),
        }
      : {}),
  };
}

function environmentBoolean(name: string): boolean | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;

  if (value === 'true') return true;

  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function environmentS3LockMode(): S3PublicationLockMode {
  const value = process.env.ATLAS_S3_LOCK_MODE;
  if (value === undefined || value === 's3') return 's3';

  if (value === 'external') return 'external';
  throw new Error('ATLAS_S3_LOCK_MODE must be "s3" or "external".');
}
