import { AtlasDeployService } from '../../deployment/index.js';
import {
  AtlasPublishService,
  loadAtlasRegistryConfig,
  readOpenPreviews,
} from '../../publication/index.js';
import {
  ui,
  type AtlasInvocation,
  type CliArguments,
} from '../../shared/index.js';
import {
  configuredHostUrls,
  verifyHostUrls,
} from '../host-verification/host-verification.js';

export async function runRegistryCommand({
  args,
  invocation,
}: {
  args: CliArguments;
  invocation: AtlasInvocation;
}): Promise<boolean> {
  if (invocation.command === 'deploy' && invocation.subcommand) {
    await deploy({ args, artifact: invocation.subcommand });

    return true;
  }

  if (invocation.command === 'remove-preview' && invocation.subcommand) {
    await removePreview({ args, artifact: invocation.subcommand });

    return true;
  }

  if (invocation.command === 'prune-previews') {
    await prunePreviews(args);

    return true;
  }

  if (invocation.command === 'verify') {
    await verify(args);

    return true;
  }

  return false;
}

async function deploy({
  args,
  artifact,
}: {
  args: CliArguments;
  artifact: string;
}): Promise<void> {
  ui.heading(`Deploy · ${artifact}`);

  const config = await loadAtlasRegistryConfig(args);
  const result = await new AtlasDeployService(args).run(artifact, config);

  ui.success(
    `${result.artifactId}@${result.version} deployed to ${result.environment}.`,
  );

  if (result.dryRun) return;

  const hostUrls = config?.hostUrls ?? [];

  if (hostUrls.length) await verifyHostUrls(hostUrls);
}

async function removePreview({
  args,
  artifact,
}: {
  args: CliArguments;
  artifact: string;
}): Promise<void> {
  const previewNumber = previewSelector(args);
  const config = await loadAtlasRegistryConfig(args);
  const result = await new AtlasPublishService(args).removePreview(
    artifact,
    previewNumber,
    config,
  );

  if (result.removed) ui.success(`Removed preview #${previewNumber}.`);
  else ui.info(`Preview #${previewNumber} was not registered.`);
}

async function prunePreviews(args: CliArguments): Promise<void> {
  const stateFile = args.flag('state-file');

  if (!stateFile || stateFile === 'true')
    throw new Error('atlas prune-previews requires --state-file.');

  const previewStates = await readOpenPreviews(stateFile);
  const config = await loadAtlasRegistryConfig(args);
  const result = await new AtlasPublishService(args).prunePreviews(
    previewStates,
    config,
  );
  ui.success(
    `Checked ${result.checked} preview(s); removed ${result.removed} selection(s) and ${result.removedGenerations} expired generation(s).`,
  );
}

async function verify(args: CliArguments): Promise<void> {
  const hostUrls = configuredHostUrls({ args });

  if (!hostUrls.length)
    throw new Error('--host-url or ATLAS_HOST_URLS is required.');

  ui.heading('Verify deployment');
  await verifyHostUrls(hostUrls);
  ui.success(`Verified ${hostUrls.length} deployment(s).`);
}

function previewSelector(args: CliArguments): number {
  const pr = args.flag('pr');
  const mr = args.flag('mr');

  if ((pr === undefined) === (mr === undefined))
    throw new Error('Pass exactly one of --pr or --mr.');

  const value = Number(pr ?? mr);

  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error('--pr and --mr must be positive integers.');

  return value;
}
