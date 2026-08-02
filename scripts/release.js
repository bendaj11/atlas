import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execute } from './process.js';
import { versionPackages } from './version-packages.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const releaseTypes = ['patch', 'minor', 'major'];

export function nextVersion(currentVersion, releaseType) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(
    currentVersion,
  );
  if (!match)
    throw new Error(
      `Current Atlas version "${currentVersion}" is not valid semantic versioning.`,
    );
  if (!releaseTypes.includes(releaseType)) {
    throw new Error(`Release type must be one of: ${releaseTypes.join(', ')}.`);
  }

  const [, majorText, minorText, patchText] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export async function prepareRelease(releaseType, workspaceRoot = root) {
  const manifest = JSON.parse(
    await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'),
  );
  const version = nextVersion(manifest.version, releaseType);
  await versionPackages(version, workspaceRoot);
  return { previousVersion: manifest.version, version };
}

async function main() {
  const [argument] = process.argv.slice(2);
  if (argument === '--verify') return verifyRelease();
  if (argument?.startsWith('--'))
    throw new Error(`Unsupported release option ${argument}.`);

  const manifest = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const release = await releaseForArgument(
    argument ?? (await selectReleaseType(manifest.version)),
    manifest.version,
  );
  console.info(
    `Prepared Atlas ${release.version}. Update the changelog, commit, and tag v${release.version}.`,
  );
  await verifyRelease();
}

async function releaseForArgument(argument, currentVersion) {
  if (releaseTypes.includes(argument)) return prepareRelease(argument);
  await versionPackages(argument);
  return { previousVersion: currentVersion, version: argument };
}

async function selectReleaseType(currentVersion) {
  if (!process.stdin.isTTY) {
    throw new Error('Choose a release type: pnpm release patch|minor|major');
  }

  const choices = releaseTypes
    .map(
      (type, index) =>
        `  ${index + 1}) ${type.padEnd(5)} ${nextVersion(currentVersion, type)}`,
    )
    .join('\n');
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer =
      (
        await prompt.question(
          `Current Atlas version: ${currentVersion}\n${choices}\nSelect release [1]: `,
        )
      ).trim() || '1';
    const selected = releaseTypes[Number(answer) - 1] ?? answer.toLowerCase();
    if (!releaseTypes.includes(selected))
      throw new Error('Select 1, 2, 3, patch, minor, or major.');
    return selected;
  } finally {
    prompt.close();
  }
}

async function verifyRelease() {
  await execute('pnpm', ['run', 'pack:verify'], {
    cwd: root,
    stdio: 'inherit',
  });
  await execute('node', ['scripts/create-release-bundle.js'], {
    cwd: root,
    stdio: 'inherit',
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `[error] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
