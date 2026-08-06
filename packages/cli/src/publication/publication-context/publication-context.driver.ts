import { faker } from '@faker-js/faker';
import { CliArguments } from '../../cli/arguments.js';
import {
  type AtlasPublicationContext,
  resolvePublicationContext,
} from './publication-context.js';

type PublicationScenario =
  'pull-request' | 'required-branch' | 'unmatched-branch';

export class PublicationContextDriver {
  private readonly branch = faker.git.branch();
  private readonly defaultBranch = faker.git.branch();
  private readonly pullRequestNumber = faker.number.int({
    min: 1,
    max: 10_000,
  });
  private context?: AtlasPublicationContext;
  private action?: () => AtlasPublicationContext;

  readonly given = {
    publication: (scenario: PublicationScenario): void => {
      const flags = [
        'publish',
        faker.word.noun(),
        `--git-branch=${this.branch}`,
        ...(scenario === 'pull-request'
          ? [`--pr-number=${this.pullRequestNumber}`]
          : [`--default-branch=${this.defaultBranch}`]),
        ...(scenario === 'required-branch' ? ['--require-publication'] : []),
      ];

      this.action = () =>
        resolvePublicationContext(new CliArguments(flags), process.cwd());
    },
  };

  readonly when = {
    resolve: (): void => {
      this.context = this.currentAction()();
    },
  };

  readonly get = {
    context: (): AtlasPublicationContext => {
      if (!this.context)
        throw new Error('Publication context was not available.');

      return this.context;
    },
    skippedWithoutPullRequest: (): boolean => {
      const context = this.context;

      return (
        context?.publish === false &&
        context.reason?.includes('has no pull request number') === true
      );
    },
    action: (): (() => AtlasPublicationContext) => this.currentAction(),
  };

  private currentAction(): () => AtlasPublicationContext {
    if (!this.action) throw new Error('Publication setup was not available.');

    return this.action;
  }
}
