import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excludedPrefixes = ['graphify-out/', '.claude/', '.codex/'];
const excludedFiles = ['CHANGELOG.md'];
const frameworkGuideDirectories = [
  'docs/guides/react/',
  'docs/guides/angular/',
];
const fencePattern = /^\s*(```|~~~)/;
const inlineLinkPattern =
  /!?\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g;
const referenceLinkPattern = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm;
const htmlAnchorPattern = /<a\s[^>]*(?:id|name)=["']([^"']+)["']/gi;
const schemePattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const angularGuideDirectory = 'docs/guides/angular/';
const bannedTerms = [
  'active host manifest',
  'host client',
  'host shell',
  'main application page',
  'the shell',
  'app shell',
];
const cliCommands = [
  'dev',
  'generate',
  'g',
  'publish',
  'deploy',
  'verify',
  'bootstrap',
  'build',
  'compile-config',
  'remove-preview',
  'prune-previews',
  'version',
];
const inlineCodePattern = /`([^`]+)`/g;
const bareCliPattern = new RegExp(
  `^atlas\\s+(?:${cliCommands.join('|')})(?:\\s|$)`,
);
const sdkAssignmentPattern =
  /([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*injectAtlasSdk\b/g;

interface MarkdownLine {
  readonly number: number;
  readonly text: string;
  readonly fenced: boolean;
}

export interface VerifyDocsOptions {
  readonly root: string;
  readonly files: readonly string[];
}

export function verifyDocs({ root, files }: VerifyDocsOptions): string[] {
  const problems: string[] = [];
  const inboundLinks = new Set<string>();
  const anchorCache = new Map<string, Set<string>>();

  for (const file of files) {
    const text = stripCode(readFileSync(join(root, file), 'utf8'));

    for (const href of extractLinks(text)) {
      if (schemePattern.test(href)) continue;

      const [pathPart = '', hash] = splitHref(href);
      const target = pathPart
        ? resolveTarget({ fromFile: file, toPath: pathPart })
        : file;

      if (!existsSync(join(root, target))) {
        problems.push(`Missing link target: ${file} -> ${href}`);
        continue;
      }

      if (target !== file) inboundLinks.add(target);

      if (!hash || !isMarkdownFile({ root, path: target })) continue;

      const anchors =
        anchorCache.get(target) ??
        collectAnchors(readFileSync(join(root, target), 'utf8'));
      anchorCache.set(target, anchors);

      if (!anchors.has(safeDecode(hash).toLowerCase()))
        problems.push(`Missing anchor: ${file} -> ${href}`);
    }
  }

  const docsPages = files.filter((file) => file.startsWith('docs/'));

  for (const page of docsPages) {
    if (!inboundLinks.has(page))
      problems.push(
        `Orphan page: ${page} is not linked from any other Markdown file`,
      );

    if (!hasRequiredFrontmatter(readFileSync(join(root, page), 'utf8')))
      problems.push(
        `Missing frontmatter: ${page} needs a title and a description`,
      );
  }

  problems.push(...compareFrameworkGuides(files));

  for (const file of files.filter(isStyleCheckedFile)) {
    const text = readFileSync(join(root, file), 'utf8');
    const lines = classifyLines(text);

    problems.push(
      ...findBannedTerms({ file, lines }),
      ...findBareCliCommands({ file, lines }),
      ...findTitleMismatch({ file, text, lines }),
    );

    if (file.startsWith(angularGuideDirectory))
      problems.push(...findAngularSdkNames({ file, lines }));
  }

  return problems;
}

function isStyleCheckedFile(file: string): boolean {
  return file === 'README.md' || file.startsWith('docs/');
}

function classifyLines(text: string): MarkdownLine[] {
  let fence: string | undefined;

  return text.split('\n').map((text, index) => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(text)?.[1];
    const number = index + 1;

    if (fence === undefined && marker !== undefined) {
      fence = marker;

      return { number, text, fenced: true };
    }

    if (fence !== undefined) {
      const closes =
        marker !== undefined &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        text.trim() === marker;

      if (closes) fence = undefined;

      return { number, text, fenced: true };
    }

    return { number, text, fenced: false };
  });
}

function findBannedTerms({
  file,
  lines,
}: {
  file: string;
  lines: readonly MarkdownLine[];
}): string[] {
  return lines
    .filter((line) => !line.fenced)
    .flatMap((line) => {
      const prose = line.text.replace(inlineCodePattern, '');

      return bannedTerms
        .filter((term) =>
          new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i').test(prose),
        )
        .map((term) => `Banned term: ${file}:${line.number} uses "${term}"`);
    });
}

function findBareCliCommands({
  file,
  lines,
}: {
  file: string;
  lines: readonly MarkdownLine[];
}): string[] {
  return lines
    .filter((line) => !line.fenced)
    .flatMap((line) =>
      [...line.text.matchAll(inlineCodePattern)]
        .map((match) => (match[1] ?? '').trim())
        .filter((code) => bareCliPattern.test(code))
        .map(
          (code) =>
            `CLI without npx: ${file}:${line.number} -> \`${code}\` should start with \`npx atlas\``,
        ),
    );
}

function findTitleMismatch({
  file,
  text,
  lines,
}: {
  file: string;
  text: string;
  lines: readonly MarkdownLine[];
}): string[] {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1];
  const title = frontmatter
    ?.match(/^title:\s*(.*?)\s*$/m)?.[1]
    ?.replace(/^(["'])(.*)\1$/, '$2');

  if (!frontmatter || !title) return [];

  const bodyStart = frontmatter.split('\n').length + 2;
  const heading = lines
    .filter((line) => !line.fenced && line.number > bodyStart)
    .map((line) => ({
      number: line.number,
      text: /^\s{0,3}#\s+(.*?)\s*#*\s*$/.exec(line.text)?.[1],
    }))
    .find((line) => line.text !== undefined);

  if (heading?.text === title) return [];

  const titleLine =
    lines.find((line) => line.number <= bodyStart && /^title:/.test(line.text))
      ?.number ?? 1;

  return [
    `Title mismatch: ${file}:${heading?.number ?? titleLine} frontmatter title "${title}" does not match first heading "${heading?.text ?? ''}"`,
  ];
}

function findAngularSdkNames({
  file,
  lines,
}: {
  file: string;
  lines: readonly MarkdownLine[];
}): string[] {
  return lines
    .filter((line) => line.fenced)
    .flatMap((line) =>
      [...line.text.matchAll(sdkAssignmentPattern)]
        .map((match) => match[1] ?? '')
        .filter((name) => name !== 'sdk')
        .map(
          (name) =>
            `Angular SDK name: ${file}:${line.number} assigns injectAtlasSdk to "${name}" instead of "sdk"`,
        ),
    );
}

function stripCode(text: string): string {
  let inFence = false;

  return text
    .split('\n')
    .map((line) => {
      if (fencePattern.test(line)) {
        inFence = !inFence;

        return '';
      }

      return inFence ? '' : line.replace(/`[^`]*`/g, '');
    })
    .join('\n');
}

function extractLinks(text: string): string[] {
  return [
    ...[...text.matchAll(inlineLinkPattern)].map((match) => match[1] ?? ''),
    ...[...text.matchAll(referenceLinkPattern)].map((match) => match[1] ?? ''),
  ].filter(Boolean);
}

function splitHref(href: string): [string, string | undefined] {
  const index = href.indexOf('#');

  if (index === -1) return [href, undefined];

  return [href.slice(0, index), href.slice(index + 1)];
}

function resolveTarget({
  fromFile,
  toPath,
}: {
  fromFile: string;
  toPath: string;
}): string {
  const decoded = safeDecode(toPath);

  if (decoded.startsWith('/')) return posix.normalize(decoded.slice(1));

  return posix.normalize(posix.join(posix.dirname(fromFile), decoded));
}

function isMarkdownFile({
  root,
  path,
}: {
  root: string;
  path: string;
}): boolean {
  return path.endsWith('.md') && statSync(join(root, path)).isFile();
}

function collectAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  const occurrences = new Map<string, number>();
  let inFence = false;

  for (const line of text.split('\n')) {
    if (fencePattern.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    for (const match of line.matchAll(htmlAnchorPattern))
      anchors.add((match[1] ?? '').toLowerCase());

    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)?.[1];

    if (heading === undefined) continue;

    const slug = slugify(heading);
    const count = occurrences.get(slug);
    occurrences.set(slug, (count ?? -1) + 1);
    anchors.add(count === undefined ? slug : `${slug}-${count + 1}`);
  }

  return anchors;
}

function slugify(heading: string): string {
  return heading
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

function hasRequiredFrontmatter(text: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1];

  if (frontmatter === undefined) return false;

  return (
    /^title:\s*\S/m.test(frontmatter) && /^description:\s*\S/m.test(frontmatter)
  );
}

function compareFrameworkGuides(files: readonly string[]): string[] {
  const [first = '', second = ''] = frameworkGuideDirectories;
  const firstPages = pagesBelow({ files, directory: first });
  const secondPages = pagesBelow({ files, directory: second });

  return [
    ...[...firstPages]
      .filter((page) => !secondPages.has(page))
      .map(
        (page) =>
          `Framework guide mismatch: ${first}${page} has no counterpart in ${second}`,
      ),
    ...[...secondPages]
      .filter((page) => !firstPages.has(page))
      .map(
        (page) =>
          `Framework guide mismatch: ${second}${page} has no counterpart in ${first}`,
      ),
  ];
}

function pagesBelow({
  files,
  directory,
}: {
  files: readonly string[];
  directory: string;
}): Set<string> {
  return new Set(
    files
      .filter((file) => file.startsWith(directory))
      .map((file) => file.slice(directory.length)),
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function listMarkdownFiles(workspaceRoot: string): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
    { cwd: workspaceRoot, encoding: 'utf8' },
  );

  return [...new Set(output.split('\n'))]
    .filter(Boolean)
    .filter((file) => !file.split('/').includes('node_modules'))
    .filter(
      (file) => !excludedPrefixes.some((prefix) => file.startsWith(prefix)),
    )
    .filter((file) => !excludedFiles.includes(file))
    .filter((file) => existsSync(join(workspaceRoot, file)))
    .sort();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const files = listMarkdownFiles(root);
  const problems = verifyDocs({ root, files });

  problems.forEach((problem) => console.error(problem));

  if (problems.length > 0) {
    console.error(
      `Found ${problems.length} documentation problem(s) in ${files.length} Markdown files.`,
    );
    process.exitCode = 1;
  } else {
    console.info(`Verified ${files.length} Markdown files.`);
  }
}
