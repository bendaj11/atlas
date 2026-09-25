import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { stdin, stdout } from 'node:process';
import { TerminalPrompter, ui } from './ui.js';

type UiScenario =
  | 'logo'
  | 'heading'
  | 'success'
  | 'warning'
  | 'single-action-error'
  | 'multiple-action-error'
  | 'result'
  | 'linked-result'
  | 'progress'
  | 'failed-progress';

export class UiDriver {
  private readonly subject = faker.word.noun();
  private readonly action = faker.word.verb();
  private readonly url = faker.internet.url();
  private readonly info = jest.fn();
  private readonly error = jest.fn();
  private readonly originalError = console.error;
  private readonly originalInfo = console.info;
  private readonly originalNoColor = process.env.NO_COLOR;
  private readonly originalTerm = process.env.TERM;
  private readonly originalCi = process.env.CI;
  private readonly write = jest.fn<(chunk: string | Uint8Array) => boolean>(
    () => true,
  );
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
      colors = false,
      inputIsTTY,
      outputIsTTY,
    }: {
      colors?: boolean;
      inputIsTTY: boolean;
      outputIsTTY: boolean;
    }) => {
      Object.defineProperty(stdin, 'isTTY', {
        configurable: true,
        value: inputIsTTY,
      });
      Object.defineProperty(stdout, 'isTTY', {
        configurable: true,
        value: outputIsTTY,
      });
      if (colors) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = '1';
      process.env.TERM = 'xterm-256color';
      delete process.env.CI;
    },
  };

  when = {
    show: (scenario: UiScenario) => {
      Object.assign(console, { error: this.error, info: this.info });
      const write = jest.spyOn(stdout, 'write').mockImplementation(this.write);
      try {
        if (scenario === 'logo') ui.logo();
        if (scenario === 'heading') ui.heading(`Publish · ${this.subject}`);
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
            `Publish failed. Suggested actions: 1) ${this.action}. 2) Rerun atlas publish.`,
          );
        }
        if (scenario === 'result') ui.result(this.subject, this.url);
        if (scenario === 'linked-result')
          ui.linkedResult(this.subject, this.url, `${this.url}?activate=true`);
        if (scenario === 'progress') {
          ui.progress.start(`Uploading ${this.subject}`);
          ui.progress.update(`Uploading ${this.subject} 1/2`);
          ui.progress.succeed(`Uploaded ${this.subject}`);
        }
        if (scenario === 'failed-progress') {
          ui.progress.start(`Checking ${this.subject}`);
          ui.progress.fail(`Found a problem on ${this.subject}`);
        }
      } finally {
        write.mockRestore();
        Object.assign(console, {
          error: this.originalError,
          info: this.originalInfo,
        });
        this.restoreTerminalDescriptors();
      }
    },
    createPrompter: () => {
      try {
        this.prompter = new TerminalPrompter();
      } finally {
        this.restoreTerminalDescriptors();
      }
    },
  };

  get = {
    errorCalls: () => this.error.mock.calls,
    writeCalls: () => this.write.mock.calls,
    infoCalls: () => this.info.mock.calls,
    logo: () => [
      [
        `
 ┌──────  ┌──────── ┌──      ┌──────   ┌──────        ┌──────  ┌──     ┌────
┌──   ┌──    ┌──    ┌──     ┌──   ┌── ┌──            ┌──   ┌── ┌──      ┌──
┌────────    ┌──    ┌──     ┌────────  ┌──────       ┌──       ┌──      ┌──
┌──   ┌──    ┌──    ┌──     ┌──   ┌──       ┌──      ┌──   ┌── ┌──      ┌──
┌──   ┌──    ┌──    ┌────── ┌──   ┌──  ┌──────        ┌──────  ┌────── ┌────`,
      ],
    ],
    logoUsesColors: () => {
      const logo = this.info.mock.calls[0]?.[0];
      return (
        typeof logo === 'string' &&
        logo.includes('\u001B[38;2;10;143;252m') &&
        logo.includes('\u001B[38;2;255;255;255m')
      );
    },
    heading: () => [[`\nAtlas · Publish · ${this.subject}`]],
    success: () => [[`✓ Built ${this.subject}.`]],
    warning: () => [[` WARN  ${this.subject} has no header.`]],
    singleActionError: () => [
      [`✖ Could not build ${this.subject}.`],
      [`  Suggested action: ${this.action}, then retry.`],
    ],
    multipleActionError: () => [
      ['✖ Publish failed.'],
      ['  Suggested actions:'],
      [`    1. ${this.action}.`],
      ['    2. Rerun atlas publish.'],
    ],
    result: () => [[`${this.subject}: ${this.url}`]],
    linkedResult: () => [
      [
        `${this.subject}: \u001B]8;;${this.url}?activate=true\u0007${this.url}\u001B]8;;\u0007`,
      ],
    ],
    progress: () => [
      [`i Uploading ${this.subject}`],
      [`✓ Uploaded ${this.subject}`],
    ],
    failedProgress: () => [[`✖ Found a problem on ${this.subject}`]],
    spinnerFrames: () => [
      [`\r\u001B[2K⠋ Uploading ${this.subject}`],
      [`\r\u001B[2K⠋ Uploading ${this.subject} 1/2`],
      ['\r\u001B[2K'],
    ],
    isPromptInteractive: () => this.prompter?.interactive ?? false,
  };

  private restoreTerminalDescriptors(): void {
    if (this.originalNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = this.originalNoColor;
    if (this.originalTerm === undefined) delete process.env.TERM;
    else process.env.TERM = this.originalTerm;
    if (this.originalCi === undefined) delete process.env.CI;
    else process.env.CI = this.originalCi;
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
