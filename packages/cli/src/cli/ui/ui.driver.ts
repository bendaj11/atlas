import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { stdin, stdout } from 'node:process';
import { TerminalPrompter, ui } from './ui.js';

type UiScenario =
  | 'heading'
  | 'success'
  | 'warning'
  | 'single-action-error'
  | 'multiple-action-error'
  | 'result'
  | 'linked-result';

export class UiDriver {
  private readonly subject = faker.word.noun();
  private readonly action = faker.word.verb();
  private readonly url = faker.internet.url();
  private readonly info = jest.fn();
  private readonly error = jest.fn();
  private readonly originalError = console.error;
  private readonly originalInfo = console.info;
  private readonly originalTerm = process.env.TERM;
  private readonly inputTtyDescriptor = Object.getOwnPropertyDescriptor(
    stdin,
    'isTTY',
  );
  private readonly outputTtyDescriptor = Object.getOwnPropertyDescriptor(
    stdout,
    'isTTY',
  );
  private prompter?: TerminalPrompter;

  given = {
    terminal: ({
      inputIsTTY,
      outputIsTTY,
    }: {
      inputIsTTY: boolean;
      outputIsTTY: boolean;
    }): void => {
      Object.defineProperty(stdin, 'isTTY', {
        configurable: true,
        value: inputIsTTY,
      });
      Object.defineProperty(stdout, 'isTTY', {
        configurable: true,
        value: outputIsTTY,
      });
      process.env.TERM = 'xterm-256color';
    },
  };

  when = {
    show: (scenario: UiScenario): void => {
      Object.assign(console, { error: this.error, info: this.info });
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
        if (scenario === 'linked-result')
          ui.linkedResult(this.subject, this.url, `${this.url}?activate=true`);
      } finally {
        Object.assign(console, {
          error: this.originalError,
          info: this.originalInfo,
        });
        this.restoreTerminalDescriptors();
      }
    },
    createPrompter: (): void => {
      try {
        this.prompter = new TerminalPrompter();
      } finally {
        this.restoreTerminalDescriptors();
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
    linkedResult: (): readonly unknown[][] => [
      [
        `${this.subject}: \u001B]8;;${this.url}?activate=true\u0007${this.url}\u001B]8;;\u0007`,
      ],
    ],
    isPromptInteractive: (): boolean => this.prompter?.interactive ?? false,
  };

  private restoreTerminalDescriptors(): void {
    if (this.originalTerm === undefined) delete process.env.TERM;
    else process.env.TERM = this.originalTerm;
    if (this.inputTtyDescriptor) {
      Object.defineProperty(stdin, 'isTTY', this.inputTtyDescriptor);
    } else {
      Reflect.deleteProperty(stdin, 'isTTY');
    }
    if (this.outputTtyDescriptor) {
      Object.defineProperty(stdout, 'isTTY', this.outputTtyDescriptor);
    } else {
      Reflect.deleteProperty(stdout, 'isTTY');
    }
  }
}
