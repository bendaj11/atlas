import {
  readPositiveEnvironmentInteger,
  requiredStorageValue,
  selectStorageFromEnvironment,
  type StorageBackendSelection,
} from './storage-environment.js';
import { CliArguments } from '../../shared/index.js';

const ENVIRONMENT_KEYS = [
  'ATLAS_STORAGE',
  'ATLAS_S3_BUCKET',
  'ATLAS_STORAGE_API_URL',
  'ATLAS_STORAGE_KEY_PREFIX',
  'ATLAS_S3_REGION',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'ATLAS_S3_FORCE_PATH_STYLE',
  'ATLAS_S3_LOCK_MODE',
  'ATLAS_STORAGE_ACCESS_KEY_ID',
  'ATLAS_STORAGE_SECRET_ACCESS_KEY',
  'ATLAS_STORAGE_SESSION_TOKEN',
  'ATLAS_TEST_LIMIT',
  'ATLAS_TEST_REQUIRED',
];

export class StorageEnvironmentDriver {
  private flags: string[] = [];
  private environment: NodeJS.ProcessEnv = {};

  readonly given = {
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    environment: (environment: NodeJS.ProcessEnv): this => {
      this.environment = environment;

      return this;
    },
  };

  readonly get = {
    selection: (): StorageBackendSelection | undefined =>
      this.withEnvironment(() =>
        selectStorageFromEnvironment(
          new CliArguments(['publish', 'x', ...this.flags]),
        ),
      ),
    requiredValue: (
      flag: string | undefined,
      environmentName: string,
    ): string =>
      this.withEnvironment(() =>
        requiredStorageValue({
          args: new CliArguments(['publish', 'x', ...this.flags]),
          flag,
          environmentName,
        }),
      ),
    positiveInteger: (name: string): number | undefined =>
      this.withEnvironment(() => readPositiveEnvironmentInteger(name)),
  };

  private withEnvironment<T>(action: () => T): T {
    const original = { ...process.env };
    for (const key of ENVIRONMENT_KEYS) delete process.env[key];
    Object.assign(process.env, this.environment);
    try {
      return action();
    } finally {
      for (const key of ENVIRONMENT_KEYS) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  }
}
