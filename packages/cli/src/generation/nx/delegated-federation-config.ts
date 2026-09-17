import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { doesPathExist } from '../../shared/index.js';
import { normalizeProjectRoot } from './nx-project.js';

export async function alignDelegatedAngularFederationConfig({
  workspaceRoot,
  root,
}: {
  workspaceRoot: string;
  root: string;
}): Promise<void> {
  const projectRoot = normalizeProjectRoot({ workspaceRoot, root });

  if (projectRoot === '.') return;

  const configPath = join(root, 'federation.config.js');

  if (!(await doesPathExist(configPath))) return;

  const source = await readFile(configPath, 'utf8');
  const escapedProjectRoot = escapeRegExp(projectRoot);
  const next = source
    .replace(
      new RegExp(
        `(["'\`])\\./(?:${escapedProjectRoot}/)?src/entry\\.ts\\1`,
        'g',
      ),
      `join(__dirname, "src/entry.ts")`,
    )
    .replace(
      new RegExp(
        `\`\\./(?:${escapedProjectRoot}/)?src/exported-widgets/\\$\\{entry\\.name\\}/index\\.ts\``,
        'g',
      ),
      `join(__dirname, "src/exported-widgets", entry.name, "index.ts")`,
    );

  if (next !== source) await writeFile(configPath, next, 'utf8');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
