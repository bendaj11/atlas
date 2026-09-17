import { execFileSync } from 'node:child_process';
import {
  assertReleaseVersion,
  type AtlasPublishedArtifactManifest,
  type AtlasVersionChannel,
} from '@atlas/schema';
import type { CliArguments } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

export interface ReleaseIdentity {
  channel: AtlasVersionChannel;
  version: string;
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
  prNumber?: number;
}

export type PublicationIdentity = Pick<
  AtlasPublishedArtifactManifest,
  'release' | 'preview' | 'source'
>;

interface GitIdentity {
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
}

export function publicationIdentity(options: {
  args: CliArguments;
  project: AtlasProject;
}): PublicationIdentity {
  const { args, project } = options;
  const version = args.flag('version');
  const pr = args.flag('pr');
  const mr = args.flag('mr');
  const selected = [version, pr, mr].filter((value) => value !== undefined);
  if (selected.length !== 1) {
    throw new Error(
      'Atlas publish requires exactly one of --version, --pr, or --mr.',
    );
  }
  const source = gitIdentity(args, project.root);

  if (version !== undefined) {
    assertReleaseVersion(version);

    return {
      release: { version },
      ...(Object.keys(source).length ? { source } : {}),
    };
  }
  const previewNumber = parseOptionalNumber(pr ?? mr);
  if (!previewNumber || previewNumber < 1) {
    throw new Error('--pr and --mr must be positive integers.');
  }
  const { gitSha, ...rest } = source;
  if (!gitSha) {
    throw new Error(
      'Preview publication requires the checked-out Git SHA or --git-sha.',
    );
  }

  return { preview: { number: previewNumber, gitSha, ...rest } };
}

export function releaseIdentity(options: {
  args: CliArguments;
  project: AtlasProject;
  environment?: NodeJS.ProcessEnv;
}): ReleaseIdentity {
  const { args, project, environment = process.env } = options;
  const prNumber = parseOptionalNumber(
    args.flag('pr') ?? args.flag('mr') ?? args.flag('pr-number'),
  );
  const explicitChannel = args.flag('channel') ?? environment.ATLAS_CHANNEL;
  const channel = explicitChannel
    ? args.channel(explicitChannel)
    : prNumber
      ? 'pr'
      : 'production';
  const packageVersion = args.flag('version') ?? project.version ?? '0.0.0';
  const version =
    channel === 'pr' && prNumber
      ? `${packageVersion.split('+')[0]!.split('-')[0]}-pr.${prNumber}`
      : packageVersion;

  return {
    channel,
    version,
    ...gitIdentity(args, project.root),
    ...(prNumber ? { prNumber } : {}),
  };
}

function gitIdentity(args: CliArguments, root: string): GitIdentity {
  const gitSha = args.flag('git-sha') ?? gitOutput(root, ['rev-parse', 'HEAD']);
  const gitBranch =
    args.flag('git-branch') ?? gitOutput(root, ['branch', '--show-current']);
  const gitCommitTitle =
    args.flag('git-commit-title') ??
    gitOutput(root, ['log', '-1', '--pretty=%s']);

  return {
    ...(gitSha ? { gitSha } : {}),
    ...(gitBranch ? { gitBranch } : {}),
    ...(gitCommitTitle ? { gitCommitTitle } : {}),
  };
}

function gitOutput(root: string, args: readonly string[]): string | undefined {
  try {
    return (
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error(`Expected an integer, received "${value}".`);

  return parsed;
}
