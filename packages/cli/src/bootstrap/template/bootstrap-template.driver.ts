import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { join } from 'node:path';
import {
  type BootstrapTemplateDependencies,
  loadBootstrapTemplate,
} from './bootstrap-template.js';

type TemplateLocation = 'absolute' | 'default' | 'relative';

interface TemplateSetup {
  location: TemplateLocation;
  failure?: 'missing' | 'read';
}

export class BootstrapTemplateDriver {
  private readonly projectRoot = `/workspace/${faker.string.alphanumeric(12)}`;
  private readonly relativePath = `${faker.system.fileName()}.html`;
  private readonly absolutePath = `/templates/${faker.system.fileName()}.html`;
  private readonly contents = faker.lorem.paragraph();
  private readonly readTemplate =
    jest.fn<BootstrapTemplateDependencies['readTemplate']>();
  private configuredPath?: string;
  private error?: Error;
  private result?: string;

  readonly given = {
    template: (setup: TemplateSetup): void => {
      this.configuredPath = this.pathFor(setup.location);

      this.error = setup.failure
        ? Object.assign(new Error(faker.lorem.sentence()), {
            ...(setup.failure === 'missing' ? { code: 'ENOENT' } : {}),
          })
        : undefined;

      if (this.error) this.readTemplate.mockRejectedValue(this.error);
      else this.readTemplate.mockResolvedValue(this.contents);
    },
  };

  readonly when = {
    load: async (): Promise<void> => {
      this.result = await loadBootstrapTemplate(
        this.projectRoot,
        this.configuredPath,
        { readTemplate: this.readTemplate },
      );
    },
  };

  readonly get = {
    result: (): string | undefined => this.result,
    contents: (): string => this.contents,
    requestedPath: (): string => this.readTemplate.mock.calls[0]?.[0] ?? '',
    defaultPath: (): string => join(this.projectRoot, 'atlas.bootstrap.html'),
    relativePath: (): string => join(this.projectRoot, this.relativePath),
    absolutePath: (): string => this.absolutePath,
    error: (): Error => {
      if (!this.error) throw new Error('Template error was not available.');

      return this.error;
    },
  };

  private pathFor(location: TemplateLocation): string | undefined {
    if (location === 'absolute') return this.absolutePath;
    if (location === 'relative') return this.relativePath;

    return undefined;
  }
}
