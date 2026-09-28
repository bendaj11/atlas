import { execFileSync } from 'node:child_process';
import {
  assertReleaseVersion,
  type AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import type { CliArguments } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

export interface ReleaseIdentity {
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

export function derivePublicationIdentity(options: {
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
  const source = readGitIdentity(args, project.root);

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

export function deriveReleaseIdentity(options: {
  args: CliArguments;
  project: AtlasProject;
}): ReleaseIdentity {
  const { args, project } = options;
  const prNumber = parseOptionalNumber(args.flag('pr') ?? args.flag('mr'));

  return {
    version: args.flag('version') ?? project.version ?? '0.0.0',
    ...readGitIdentity(args, project.root),
    ...(prNumber ? { prNumber } : {}),
  };
}

function readGitIdentity(args: CliArguments, root: string): GitIdentity {
  const gitSha =
    args.flag('git-sha') ?? readGitOutput(root, ['rev-parse', 'HEAD']);
  const gitBranch =
    args.flag('git-branch') ??
    readGitOutput(root, ['branch', '--show-current']);
  const gitCommitTitle =
    args.flag('git-commit-title') ??
    readGitOutput(root, ['log', '-1', '--pretty=%s']);

  return {
    ...(gitSha ? { gitSha } : {}),
    ...(gitBranch ? { gitBranch } : {}),
    ...(gitCommitTitle ? { gitCommitTitle } : {}),
  };
}

function readGitOutput(
  root: string,
  args: readonly string[],
): string | undefined {
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
