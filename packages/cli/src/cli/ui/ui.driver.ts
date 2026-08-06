import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { ui } from './ui.js';

type UiScenario =
  | 'heading'
  | 'success'
  | 'warning'
  | 'single-action-error'
  | 'multiple-action-error'
  | 'result';

export class UiDriver {
  private readonly subject = faker.word.noun();
  private readonly action = faker.word.verb();
  private readonly url = faker.internet.url();
  private readonly info = jest.fn();
  private readonly error = jest.fn();
  private readonly originalError = console.error;
  private readonly originalInfo = console.info;

  constructor() {
    Object.assign(console, { error: this.error, info: this.info });
  }

  when = {
    show: (scenario: UiScenario): void => {
      try {
        if (scenario === 'heading') ui.heading(`Build · ${this.subject}`);
        if (scenario === 'success') ui.success(`Built ${this.subject}.`);
        if (scenario === 'warning')
          ui.warning(`${this.subject} has no header.`);
        if (scenario === 'single-action-error') {
          ui.error(
            `Could not build ${this.subject}. Suggested action: ${this.action}, then retry.`,
          );
        }
        if (scenario === 'multiple-action-error') {
          ui.error(
            `Build failed. Suggested actions: 1) ${this.action}. 2) Rerun atlas build.`,
          );
        }
        if (scenario === 'result') ui.result(this.subject, this.url);
      } finally {
        Object.assign(console, {
          error: this.originalError,
          info: this.originalInfo,
        });
      }
    },
  };

  get = {
    errorCalls: (): readonly unknown[][] => this.error.mock.calls,
    infoCalls: (): readonly unknown[][] => this.info.mock.calls,
    heading: (): readonly unknown[][] => [
      [`\nAtlas · Build · ${this.subject}`],
    ],
    success: (): readonly unknown[][] => [[`✓ Built ${this.subject}.`]],
    warning: (): readonly unknown[][] => [[`! ${this.subject} has no header.`]],
    singleActionError: (): readonly unknown[][] => [
      [`✖ Could not build ${this.subject}.`],
      [`  Suggested action: ${this.action}, then retry.`],
    ],
    multipleActionError: (): readonly unknown[][] => [
      ['✖ Build failed.'],
      ['  Suggested actions:'],
      [`    1. ${this.action}.`],
      ['    2. Rerun atlas build.'],
    ],
    result: (): readonly unknown[][] => [[`${this.subject}: ${this.url}`]],
  };
}
