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

  const BANNED_TERMS = [
    'active host manifest',
    'host client',
    'host shell',
    'main application page',
    'the shell',
    'app shell',
  ];

  it.each(BANNED_TERMS)(
    'should report the file and line of a banned term when prose uses %s',
    async (term) => {
      await driver.given.markdownFile(
        'README.md',
        `# Atlas\n\nOpen ${term.toUpperCase()} now.\n`,
      );

      expect(
        verifyDocs({
          root: driver.get.root(),
          files: driver.get.markdownFiles(),
        }),
      ).toStrictEqual([`Banned term: README.md:3 uses "${term}"`]);
    },
  );

  it('should return no problems when banned terms and bare CLI calls appear only in code fences', async () => {
    await driver.given.markdownFile(
      'README.md',
      '# Atlas\n\n```sh\n# the host shell\natlas dev orders\n```\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should return no problems when prose mentions a shell without an article', async () => {
    await driver.given.markdownFile(
      'README.md',
      '# Atlas\n\nRun the command in a shell or in your shell.\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should ignore files when they are outside docs and are not the root README', async () => {
    await driver.given.markdownFile(
      'contributing/guide.md',
      '# Guide\n\nThe host shell runs `atlas dev`.\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  const CLI_COMMANDS = [
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

  it.each(CLI_COMMANDS)(
    'should report the file and line of inline code when it runs atlas %s without npx',
    async (command) => {
      await driver.given.markdownFile(
        'README.md',
        `# Atlas\n\nRun \`atlas ${command} orders\`.\n`,
      );

      expect(
        verifyDocs({
          root: driver.get.root(),
          files: driver.get.markdownFiles(),
        }),
      ).toStrictEqual([
        `CLI without npx: README.md:3 -> \`atlas ${command} orders\` should start with \`npx atlas\``,
      ]);
    },
  );

  it('should return no problems when inline code runs the CLI through npx or names an unknown command', async () => {
    await driver.given.markdownFile(
      'README.md',
      '# Atlas\n\nRun `npx atlas dev orders` from `atlas deployer`.\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([]);
  });

  it('should report a title mismatch at the heading line when the first heading differs from the frontmatter title', async () => {
    await driver.given.markdownFile('README.md', '[Page](docs/page.md)\n');
    await driver.given.markdownFile(
      'docs/page.md',
      '---\ntitle: Deploy a host\ndescription: Learn about hosts.\n---\n\n# Deploy the host\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Title mismatch: docs/page.md:6 frontmatter title "Deploy a host" does not match first heading "Deploy the host"',
    ]);
  });

  it('should report a title mismatch at the title line when the page has no heading outside code fences', async () => {
    await driver.given.markdownFile('README.md', '[Page](docs/page.md)\n');
    await driver.given.markdownFile(
      'docs/page.md',
      "---\ntitle: 'Deploy a host'\ndescription: Learn about hosts.\n---\n\n```md\n# Deploy a host\n```\n",
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Title mismatch: docs/page.md:2 frontmatter title "Deploy a host" does not match first heading ""',
    ]);
  });

  it('should report the file and line of an Angular sample when injectAtlasSdk is assigned to a name other than sdk', async () => {
    await driver.given.markdownFile(
      'README.md',
      '[React](docs/guides/react/host.md)\n[Angular](docs/guides/angular/host.md)\n',
    );
    await driver.given.markdownFile(
      'docs/guides/react/host.md',
      '---\ntitle: Host\ndescription: Learn about Host.\n---\n\n# Host\n\n```ts\nconst atlas = injectAtlasSdk();\n```\n',
    );
    await driver.given.markdownFile(
      'docs/guides/angular/host.md',
      '---\ntitle: Host\ndescription: Learn about Host.\n---\n\n# Host\n\n```ts\nreadonly sdk = injectAtlasSdk();\nprivate readonly atlas: AtlasSdk = injectAtlasSdk();\n```\n\nconst prose = injectAtlasSdk();\n',
    );

    expect(
      verifyDocs({
        root: driver.get.root(),
        files: driver.get.markdownFiles(),
      }),
    ).toStrictEqual([
      'Angular SDK name: docs/guides/angular/host.md:10 assigns injectAtlasSdk to "atlas" instead of "sdk"',
    ]);
  });
});
