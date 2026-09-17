import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { assertNoIssues } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import type { UnknownRecord } from '../../validation/validators.js';
import {
  ATLAS_RUNTIME_CONFIG_SCHEMA_VERSION,
  type AtlasHostRuntimeConfig,
} from '../atlas-host-runtime-config.js';
import { resolveRegistryRootUrl } from './registry-root-url.js';
import { ATLAS_RUNTIME_CONFIG_PATH } from './runtime-urls.js';
import { collectRuntimeConfigFieldIssues } from './validate-host-runtime-config.js';

const INVALID_RUNTIME_CONFIG = 'Invalid Atlas runtime config.';

/** Validates a runtime config and resolves relative registry roots against the host page URL. */
export function resolveAtlasHostRuntimeConfig(
  value: unknown,
  hostUrl?: string,
): AtlasHostRuntimeConfig {
  const issues = ValidationIssues.create();
  const record = collectRuntimeConfigFieldIssues({ value, issues });

  if (!record)
    throw new AtlasValidationError(INVALID_RUNTIME_CONFIG, issues.toArray());

  const runtimeConfigUrl = hostUrl
    ? new URL(ATLAS_RUNTIME_CONFIG_PATH, hostUrl)
    : undefined;
  const artifactRegistryUrl = resolveRegistryRootUrl({
    value: record.artifactRegistryUrl,
    path: 'artifactRegistryUrl',
    runtimeConfigUrl,
    issues,
  });
  const environmentRegistryUrl =
    record.environmentRegistryUrl === undefined
      ? undefined
      : resolveRegistryRootUrl({
          value: record.environmentRegistryUrl,
          path: 'environmentRegistryUrl',
          runtimeConfigUrl,
          issues,
        });

  assertNoIssues({ issues, message: INVALID_RUNTIME_CONFIG });

  if (artifactRegistryUrl === undefined || !isHostRuntimeConfig(record))
    throw new AtlasValidationError(INVALID_RUNTIME_CONFIG, issues.toArray());

  return {
    ...record,
    artifactRegistryUrl,
    ...(environmentRegistryUrl === undefined ? {} : { environmentRegistryUrl }),
  };
}

function isHostRuntimeConfig(
  record: UnknownRecord,
): record is UnknownRecord & AtlasHostRuntimeConfig {
  return (
    record.schemaVersion === ATLAS_RUNTIME_CONFIG_SCHEMA_VERSION &&
    typeof record.hostId === 'string' &&
    typeof record.environment === 'string' &&
    typeof record.artifactRegistryUrl === 'string'
  );
}
