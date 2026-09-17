import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AtlasConfig,
  AtlasStylesheet,
  AtlasVersionChannel,
} from '@atlas/schema';
import { listArtifactFiles } from '../artifact-root/artifact-root.js';
import { normalizeArtifactPath, toPosixPath } from '../payload/payload.js';
import { sha256Integrity, readTextFile } from '../../shared/index.js';

export async function discoverStylesheets(options: {
  artifactRoot: string;
  artifactBaseUrl: string;
  framework: AtlasConfig['framework'];
  channel: AtlasVersionChannel;
}): Promise<AtlasStylesheet[]> {
  const { artifactRoot, artifactBaseUrl, framework, channel } = options;
  if (channel === 'local') {
    return framework === 'angular'
      ? [{ href: `${artifactBaseUrl}/styles.css` }]
      : [];
  }
  const declared =
    framework === 'angular'
      ? await angularInitialStylesheetPaths(artifactRoot)
      : [];
  const paths = declared.length
    ? declared
    : (await listArtifactFiles(artifactRoot)).filter((path) =>
        path.endsWith('.css'),
      );
  const stylesheets: AtlasStylesheet[] = [];
  for (const relativePath of paths) {
    const bytes = await readFile(join(artifactRoot, relativePath));
    stylesheets.push({
      href: `${artifactBaseUrl}/${toPosixPath(relativePath)}`,
      integrity: sha256Integrity(bytes),
    });
  }

  return stylesheets;
}

export function stylesheetPathsFromIndex(indexHtml: string): string[] {
  const paths = [...indexHtml.matchAll(/<link\b[^>]*>/giu)].flatMap((link) => {
    const rel = htmlAttribute(link[0], 'rel');
    const href = htmlAttribute(link[0], 'href');
    if (!isStylesheetLink(rel) || !href) return [];
    const path = artifactPathFromHref(href);

    return path?.endsWith('.css') ? [path] : [];
  });

  return [...new Set(paths)];
}

async function angularInitialStylesheetPaths(
  artifactRoot: string,
): Promise<string[]> {
  const indexHtml = await readTextFile(join(artifactRoot, 'index.html'));

  return indexHtml === undefined ? [] : stylesheetPathsFromIndex(indexHtml);
}

function isStylesheetLink(rel: string | undefined): boolean {
  return (
    rel?.split(/\s+/u).some((value) => value.toLowerCase() === 'stylesheet') ??
    false
  );
}

function htmlAttribute(tag: string, name: 'href' | 'rel'): string | undefined {
  const expression =
    name === 'href'
      ? /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu
      : /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu;
  const match = tag.match(expression);

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function artifactPathFromHref(href: string): string | undefined {
  if (href.includes('?') || href.includes('#')) return undefined;
  try {
    return normalizeArtifactPath(href);
  } catch {
    return undefined;
  }
}
