import { TemporaryDirectory } from '../packages/cli/src/shared/fs/fs.testkit.js';

export class VerifyDocsDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly files: string[] = [];

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-verify-docs-');

      return this;
    },
    markdownFile: async (relativePath: string, contents: string) => {
      await this.directory.writeFile(relativePath, contents);
      this.files.push(relativePath);

      return this;
    },
  };

  readonly get = {
    root: () => this.directory.root,
    markdownFiles: () => [...this.files],
  };
}
