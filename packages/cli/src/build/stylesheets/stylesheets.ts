import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AtlasStylesheet,
  AtlasVersionChannel,
  AtlasFramework,
} from '@atlas/schema';
import { listArtifactFiles } from '../artifact-root/artifact-root.js';
import {
  normalizeArtifactPath,
  convertToPosixPath,
} from '../payload/payload.js';
import { computeSha256Integrity, readTextFile } from '../../shared/index.js';

export async function discoverStylesheets(options: {
  artifactRoot: string;
  artifactBaseUrl: string;
  framework: AtlasFramework;
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
      ? await listAngularInitialStylesheetPaths(artifactRoot)
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
      href: `${artifactBaseUrl}/${convertToPosixPath(relativePath)}`,
      integrity: computeSha256Integrity(bytes),
    });
  }

  return stylesheets;
}

export function extractStylesheetPathsFromIndex(indexHtml: string): string[] {
  const paths = [...indexHtml.matchAll(/<link\b[^>]*>/giu)].flatMap((link) => {
    const rel = extractHtmlAttributeValue(link[0], 'rel');
    const href = extractHtmlAttributeValue(link[0], 'href');

    if (!isStylesheetLink(rel) || !href) return [];
    const path = extractArtifactPathFromHref(href);

    return path?.endsWith('.css') ? [path] : [];
  });

  return [...new Set(paths)];
}

async function listAngularInitialStylesheetPaths(
  artifactRoot: string,
): Promise<string[]> {
  const indexHtml = await readTextFile(join(artifactRoot, 'index.html'));

  return indexHtml === undefined
    ? []
    : extractStylesheetPathsFromIndex(indexHtml);
}

function isStylesheetLink(rel: string | undefined): boolean {
  return (
    rel?.split(/\s+/u).some((value) => value.toLowerCase() === 'stylesheet') ??
    false
  );
}

function extractHtmlAttributeValue(
  tag: string,
  name: 'href' | 'rel',
): string | undefined {
  const expression =
    name === 'href'
      ? /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu
      : /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu;
  const match = tag.match(expression);

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function extractArtifactPathFromHref(href: string): string | undefined {
  if (href.includes('?') || href.includes('#')) return undefined;

  try {
    return normalizeArtifactPath(href);
  } catch {
    return undefined;
  }
}
