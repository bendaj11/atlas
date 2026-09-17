import { assertValid } from '../../validation/assert-valid.js';
import { ValidationIssues } from '../../validation/validation-issues.js';
import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';
import { resolveRegistryRootUrl } from './registry-root-url.js';
import { ATLAS_RUNTIME_CONFIG_PATH } from './runtime-urls.js';
import { collectRuntimeConfigFieldIssues } from './validate-host-runtime-config.js';

/** Validates a runtime config and resolves relative registry roots against the host page URL. */
export function resolveAtlasRuntimeConfig(
  value: unknown,
  hostUrl?: string,
): AtlasHostRuntimeConfig {
  const issues = ValidationIssues.create();
  const record = collectRuntimeConfigFieldIssues({ value, issues });
  const message = 'Invalid Atlas runtime config.';

  if (!record) {
    assertValid({ issues, message });

    throw new Error(message);
  }

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

  assertValid({ issues, message });

  const runtime = record as unknown as AtlasHostRuntimeConfig;

  return {
    ...runtime,
    artifactRegistryUrl: artifactRegistryUrl as string,
    ...(environmentRegistryUrl === undefined ? {} : { environmentRegistryUrl }),
  };
}
