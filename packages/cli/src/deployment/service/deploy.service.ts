import {
  assertEnvironmentName,
  createPublicationStorage,
  verifyDeliveryWhileHeld,
  withPublicationLease,
  type AtlasRegistryConfig,
} from '../../publication/index.js';
import { CliArguments, withExponentialRetry } from '../../shared/index.js';
import {
  listDeploymentPaths,
  planDeployment,
} from '../deployment-plan/deployment-plan.js';
import { writeDeployment } from '../deployment-writer/deployment-writer.js';
import { readSourceRegistry } from '../registry-access/registry-access.js';
import { resolveRegistryLocations } from '../registry-locations/registry-locations.js';
import { selectArtifactVersion } from '../selection/selection.js';
import type { AtlasDeployResult, RegistryAccess } from '../types.js';

export class AtlasDeployService {
  constructor(private readonly args: CliArguments) {}

  run(
    artifactIdentifier: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasDeployResult> {
    return withExponentialRetry(() =>
      this.runOnce({ artifactIdentifier, config }),
    );
  }

  private async runOnce({
    artifactIdentifier,
    config,
  }: {
    artifactIdentifier: string;
    config?: AtlasRegistryConfig;
  }): Promise<AtlasDeployResult> {
    const environment = requireFlag(this.args, 'to');
    const selector = requireFlag(this.args, 'version');

    assertEnvironmentName(environment);

    const storage = await createPublicationStorage(config?.storage, this.args);
    const access: RegistryAccess = {
      storage,
      locations: resolveRegistryLocations(this.args),
    };
    const registry = await readSourceRegistry(access);
    const selected = await selectArtifactVersion({
      access,
      registry,
      identifier: artifactIdentifier,
      selector,
    });
    const dryRun = this.args.hasFlag('dry-run');
    const plan = () =>
      planDeployment({ access, registry, environment, selected });

    const deployment = dryRun
      ? await plan()
      : await withPublicationLease(storage, async (lease) => {
          const planned = await plan();

          await writeDeployment({
            storage,
            lease,
            environment,
            deployment: planned,
          });

          if (storage.verifyDelivery) {
            const paths = listDeploymentPaths({
              environment,
              deployment: planned,
            });
            await config?.invalidate?.(paths);
            await verifyDeliveryWhileHeld({ storage, lease, paths });
          }

          return planned;
        });

    if (!dryRun && !storage.verifyDelivery)
      await config?.invalidate?.(
        listDeploymentPaths({ environment, deployment }),
      );

    return {
      artifactId: selected.id,
      environment,
      version: selected.version,
      registryRevision: deployment.state.revision,
      dryRun,
    };
  }
}

function requireFlag(args: CliArguments, name: string): string {
  const value = args.flag(name);

  if (!value || value === 'true') throw new Error(`--${name} is required.`);

  return value;
}
