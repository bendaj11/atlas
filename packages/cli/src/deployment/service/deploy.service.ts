import {
  assertEnvironmentName,
  createPublicationStorage,
  resolveParallelUploads,
  verifyDeliveryWhileHeld,
  withPublicationLease,
  type AtlasRegistryConfig,
} from '../../publication/index.js';
import {
  CliArguments,
  formatDuration,
  silentProgress,
  withExponentialRetry,
  type AtlasProgressReporter,
} from '../../shared/index.js';
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
  constructor(
    private readonly args: CliArguments,
    private readonly progress: AtlasProgressReporter = silentProgress,
  ) {}

  run(
    artifactIdentifier: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasDeployResult> {
    return withExponentialRetry(
      () => this.runOnce({ artifactIdentifier, config }),
      {
        onRetry: (attempt, delayMs) =>
          this.progress.warn(
            `Storage request failed temporarily. Retrying in ${formatDuration(delayMs)} (attempt ${attempt + 1}).`,
          ),
      },
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
    const concurrency = resolveParallelUploads(this.args);

    this.progress.start('Reading registry');
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
    this.progress.succeed(
      `Selected ${artifactIdentifier} version ${selected.version}`,
    );
    const dryRun = this.args.hasFlag('dry-run');
    const plan = () =>
      planDeployment({ access, registry, environment, selected });

    if (!dryRun) this.progress.start('Waiting for publish lock');

    const deployment = dryRun
      ? await plan()
      : await withPublicationLease(storage, async (lease) => {
          this.progress.succeed('Acquired publish lock');
          this.progress.start(`Updating ${environment} registry`);
          const planned = await plan();

          await writeDeployment({
            storage,
            lease,
            environment,
            deployment: planned,
          });
          this.progress.succeed(`Updated ${environment} registry`);

          if (storage.verifyDelivery) {
            const paths = listDeploymentPaths({
              environment,
              deployment: planned,
            });
            this.progress.start('Checking public delivery');
            await config?.invalidate?.(paths);
            await verifyDeliveryWhileHeld({
              storage,
              lease,
              paths,
              concurrency,
            });
            this.progress.succeed('Public URLs serve the deployment');
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
