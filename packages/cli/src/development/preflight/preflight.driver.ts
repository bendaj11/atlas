import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { assertUsableAngularBuildPackage } from './preflight.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';

export class DevelopmentPreflightDriver {
  private readonly temporaryDirectory = new TemporaryDirectory();
  private readonly version = faker.system.semver();
  private root = '';
  private projectRoot = '';

  given = {
    angularBuild: async ({ source }: { source: 'corrupt' }) => {
      this.root = await this.temporaryDirectory.create(
        'atlas-angular-preflight-',
      );
      this.projectRoot = join(this.root, faker.word.noun());
      const packageRoot = join(this.root, 'node_modules', '@angular', 'build');
      const compilationRoot = join(
        packageRoot,
        'src',
        'tools',
        'angular',
        'compilation',
      );

      await mkdir(compilationRoot, { recursive: true });
      await mkdir(this.projectRoot, { recursive: true });
      await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify({ name: '@angular/build', version: this.version }),
      );
      await writeFile(
        join(compilationRoot, 'angular-compilation.js'),
        source === 'corrupt'
          ? "creadConfiguration('tsconfig.json');\n"
          : "readConfiguration('tsconfig.json');\n",
      );
    },
  };

  when = {
    validate: async () =>
      assertUsableAngularBuildPackage(this.root, this.projectRoot),
  };
}
