import { beforeEach, describe, expect, it } from '@jest/globals';
import { VerifyDocsDriver } from './verify-docs.driver.js';
import { verifyDocs } from './verify-docs.js';

describe('verifyDocs', () => {
  let driver: VerifyDocsDriver;

  beforeEach(async () => {
    driver = new VerifyDocsDriver();
    await driver.given.workspace();
  });

  it('should return no problems when every link, anchor, and page is valid', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[Docs](docs/README.md)\n[Start](docs/start.md#install-the-cli)\n',
    );
    await driver.given.markdownFile(
      'docs/README.md',
      '---\ntitle: Docs\ndescription: Learn about Docs.\n---\n\n# Docs\n\n[Start](start.md)\n',
    );
    await driver.given.markdownFile(
      'docs/start.md',
      '---\ntitle: Start\ndescription: Learn about Start.\n---\n\n# Start\n\n## Install the CLI\n\n[Top](#start)\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should report a missing link target when a relative link points to no file', async () => {
    await driver.given.markdownFile('README.md', '[Gone](docs/gone.md)\n');

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual(['Missing link target: README.md -> docs/gone.md']);
  });

  it('should report a missing anchor when no heading in the target matches', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[Guide](guide.md#deploy-the-host)\n',
    );
    await driver.given.markdownFile(
      'guide.md',
      '# Guide\n\n## Deploy the app\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual(['Missing anchor: README.md -> guide.md#deploy-the-host']);
  });

  it('should report a missing anchor when the matching heading is inside a code fence', async () => {
    await driver.given.markdownFile('README.md', '[Guide](guide.md#fenced)\n');
    await driver.given.markdownFile(
      'guide.md',
      '# Guide\n\n```md\n## Fenced\n```\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual(['Missing anchor: README.md -> guide.md#fenced']);
  });

  it('should resolve anchors with GitHub slug rules when headings repeat and contain code', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[Second](guide.md#run-npx-atlas-dev-1)\n',
    );
    await driver.given.markdownFile(
      'guide.md',
      '# Guide\n\n## Run `npx atlas dev`\n\n## Run `npx atlas dev`\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should ignore links when they are inside code fences or inline code', async () => {
    await driver.given.markdownFile(
      'README.md',
      '```md\n[Gone](gone.md)\n```\n\n`[Gone](gone.md)`\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should ignore links when they use a URL scheme', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[Site](https://example.com/gone.md)\n[Mail](mailto:team@example.com)\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should report an orphan page when no other Markdown file links to a docs page', async () => {
    await driver.given.markdownFile(
      'docs/lonely.md',
      '---\ntitle: Lonely\ndescription: Learn about Lonely.\n---\n\n# Lonely\n\n[Self](lonely.md)\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Orphan page: docs/lonely.md is not linked from any other Markdown file',
    ]);
  });

  it('should report missing frontmatter when a docs page has no description', async () => {
    await driver.given.markdownFile('README.md', '[Page](docs/page.md)\n');
    await driver.given.markdownFile(
      'docs/page.md',
      '---\ntitle: Page\n---\n\n# Page\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Missing frontmatter: docs/page.md needs a title and a description',
    ]);
  });

  it('should report a framework guide mismatch when only the React guides contain a page', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[React](docs/guides/react/host.md)\n',
    );
    await driver.given.markdownFile(
      'docs/guides/react/host.md',
      '---\ntitle: Host\ndescription: Learn about Host.\n---\n\n# Host\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Framework guide mismatch: docs/guides/react/host.md has no counterpart in docs/guides/angular/',
    ]);
  });

  it('should report a framework guide mismatch when only the Angular guides contain a page', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[Angular](docs/guides/angular/host.md)\n',
    );
    await driver.given.markdownFile(
      'docs/guides/angular/host.md',
      '---\ntitle: Host\ndescription: Learn about Host.\n---\n\n# Host\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Framework guide mismatch: docs/guides/angular/host.md has no counterpart in docs/guides/react/',
    ]);
  });
});
