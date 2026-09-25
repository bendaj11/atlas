import { createInterface, type Interface } from 'node:readline/promises';
import { stderr, stdin, stdout } from 'node:process';
import type { WriteStream } from 'node:tty';
import selectPrompt from '@inquirer/select';
import { formatDuration } from '../format/format.js';

type UiColor =
  | 'bold'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'red'
  | 'dim'
  | 'warningBadge';
type MessageStatus = 'info' | 'success' | 'warning' | 'error';
type RgbColor = readonly [red: number, green: number, blue: number];

const STATUS_SYMBOLS: Readonly<Record<MessageStatus, string>> = {
  info: 'i',
  success: '✓',
  warning: ' WARN ',
  error: '✖',
};

const STATUS_COLORS: Readonly<Record<MessageStatus, UiColor>> = {
  info: 'cyan',
  success: 'green',
  warning: 'warningBadge',
  error: 'red',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;
const MINIMUM_REPORTED_DURATION_MS = 1000;

interface ActiveStep {
  message: string;
  readonly startedAt: number;
  frame: number;
  readonly timer?: ReturnType<typeof setInterval>;
}

let activeStep: ActiveStep | undefined;

export interface AtlasProgressReporter {
  start(message: string): void;
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
  warn(message: string): void;
}

export const silentProgress: AtlasProgressReporter = {
  start: () => undefined,
  update: () => undefined,
  succeed: () => undefined,
  fail: () => undefined,
  warn: () => undefined,
};

const ATLAS_LOGO: readonly { text: string; color: RgbColor }[] = [
  {
    text: ' ┌──────  ┌──────── ┌──      ┌──────   ┌──────        ┌──────  ┌──     ┌────',
    color: [10, 143, 252],
  },
  {
    text: '┌──   ┌──    ┌──    ┌──     ┌──   ┌── ┌──            ┌──   ┌── ┌──      ┌──',
    color: [71, 171, 253],
  },
  {
    text: '┌────────    ┌──    ┌──     ┌────────  ┌──────       ┌──       ┌──      ┌──',
    color: [133, 199, 254],
  },
  {
    text: '┌──   ┌──    ┌──    ┌──     ┌──   ┌──       ┌──      ┌──   ┌── ┌──      ┌──',
    color: [194, 227, 254],
  },
  {
    text: '┌──   ┌──    ┌──    ┌────── ┌──   ┌──  ┌──────        ┌──────  ┌────── ┌────',
    color: [255, 255, 255],
  },
];

export interface AtlasPrompter {
  readonly interactive: boolean;
  input(message: string, fallback?: string): Promise<string>;
  select<T extends string>(
    message: string,
    choices: readonly { label: string; value: T }[],
  ): Promise<T>;
  close(): void;
}

export class TerminalPrompter implements AtlasPrompter {
  readonly interactive: boolean;
  private interface?: Interface;

  constructor(inputDisabled = false) {
    this.interactive = Boolean(
      stdin.isTTY && !process.env.CI && !inputDisabled,
    );
  }

  async input(message: string, fallback?: string): Promise<string> {
    if (!this.interactive)
      throw new Error(`${message} must be provided in non-interactive mode.`);

    while (true) {
      const suffix = fallback ? ` [${fallback}]` : '';
      const answer = (
        await this.reader().question(
          `${colorize('?', 'cyan', stdout)} ${message}${suffix}: `,
        )
      ).trim();

      if (answer) return answer;

      if (fallback) return fallback;
      ui.warning('Value required. Enter a value or press Ctrl+C to cancel.');
    }
  }

  async select<T extends string>(
    message: string,
    choices: readonly { label: string; value: T }[],
  ): Promise<T> {
    if (!this.interactive)
      throw new Error(`${message} must be provided in non-interactive mode.`);

    return selectPrompt({
      message,
      choices: choices.map(({ label, value }) => ({ name: label, value })),
    });
  }

  close(): void {
    this.interface?.close();
  }

  private reader(): Interface {
    this.interface ??= createInterface({ input: stdin, output: stdout });

    return this.interface;
  }
}

export const ui = {
  logo(): void {
    writeLine(stdout, `\n${formatLogo(stdout)}`);
  },
  heading(message: string): void {
    writeLine(
      stdout,
      `\n${colorize('Atlas', 'cyan', stdout)} ${colorize('·', 'dim', stdout)} ${colorize(message, 'bold', stdout)}`,
    );
  },
  info(message: string): void {
    writeStatus(stdout, 'info', message);
  },
  warning(message: string): void {
    writeStatus(stderr, 'warning', colorize(message, 'yellow', stderr));
  },
  success(message: string): void {
    writeStatus(stdout, 'success', message);
  },
  error(message: string): void {
    stopActiveStep();
    writeError(message);
  },
  item(message: string): void {
    writeLine(stdout, `  ${colorize('•', 'dim', stdout)} ${message}`);
  },
  result(label: string, value: string): void {
    writeLine(stdout, `${colorize(label, 'bold', stdout)}: ${value}`);
  },
  linkedResult(label: string, value: string, target: string): void {
    writeLine(
      stdout,
      `${colorize(label, 'bold', stdout)}: ${formatTerminalLink(value, target, stdout)}`,
    );
  },
  progress: {
    start(message: string): void {
      stopActiveStep();

      if (!isAnimated(stdout)) {
        writeStatus(stdout, 'info', message);
        activeStep = { message, startedAt: Date.now(), frame: 0 };

        return;
      }

      const timer = setInterval(() => {
        if (!activeStep) return;

        activeStep.frame = (activeStep.frame + 1) % SPINNER_FRAMES.length;
        drawActiveStep();
      }, SPINNER_INTERVAL_MS);
      timer.unref();
      activeStep = { message, startedAt: Date.now(), frame: 0, timer };
      drawActiveStep();
    },
    update(message: string): void {
      if (!activeStep) return;

      activeStep.message = message;

      if (activeStep.timer) drawActiveStep();
    },
    succeed(message: string): void {
      const elapsed = activeStep ? Date.now() - activeStep.startedAt : 0;
      stopActiveStep();
      const duration =
        elapsed >= MINIMUM_REPORTED_DURATION_MS
          ? ` ${colorize(`· ${formatDuration(elapsed)}`, 'dim', stdout)}`
          : '';
      writeStatus(stdout, 'success', `${message}${duration}`);
    },
    fail(message: string): void {
      stopActiveStep();
      writeStatus(stderr, 'error', message);
    },
    warn(message: string): void {
      ui.warning(message);
    },
  } satisfies AtlasProgressReporter,
};

function formatLogo(stream: WriteStream): string {
  return ATLAS_LOGO.map(({ text, color }) =>
    colorizeRgb(text, color, stream),
  ).join('\n');
}

function colorizeRgb(
  value: string,
  [red, green, blue]: RgbColor,
  stream: WriteStream,
): string {
  if (!stream.isTTY || process.env.NO_COLOR || process.env.TERM === 'dumb')
    return value;

  return `\u001B[38;2;${red};${green};${blue}m${value}\u001B[0m`;
}

function formatTerminalLink(
  value: string,
  target: string,
  stream: WriteStream,
): string {
  if (!stream.isTTY || process.env.TERM === 'dumb') return value;
  return `\u001B]8;;${target}\u0007${value}\u001B]8;;\u0007`;
}

function writeStatus(
  stream: WriteStream,
  status: MessageStatus,
  message: string,
): void {
  const symbol = colorize(
    STATUS_SYMBOLS[status],
    STATUS_COLORS[status],
    stream,
  );
  writeLine(stream, `${symbol} ${indentContinuationLines(message)}`);
}

function writeError(message: string): void {
  const [summary, action] = message.split(/\s+Suggested actions?:\s+/, 2);
  writeStatus(stderr, 'error', summary ?? message);

  if (action) {
    const actions = [
      ...action.matchAll(/(?:^|\s)(\d+)\)\s+(.+?)(?=\s+\d+\)|$)/gu),
    ];

    if (actions.length > 1) {
      writeLine(stderr, `  ${colorize('Suggested actions:', 'bold', stderr)}`);
      actions.forEach((match) =>
        writeLine(stderr, `    ${match[1]}. ${match[2]}`),
      );
    } else {
      writeLine(
        stderr,
        `  ${colorize('Suggested action:', 'bold', stderr)} ${action}`,
      );
    }
  }
}

function indentContinuationLines(message: string): string {
  return message.replace(/\n/g, '\n  ');
}

function writeLine(stream: WriteStream, message: string): void {
  clearActiveStep();

  if (stream === stderr) console.error(message);
  else console.info(message);

  if (activeStep?.timer) drawActiveStep();
}

function isAnimated(stream: WriteStream): boolean {
  return (
    Boolean(stream.isTTY) && !process.env.CI && process.env.TERM !== 'dumb'
  );
}

function drawActiveStep(): void {
  if (!activeStep) return;

  const frame = colorize(SPINNER_FRAMES[activeStep.frame]!, 'cyan', stdout);
  const width = Math.max((stdout.columns ?? 80) - 3, 1);
  const message =
    activeStep.message.length > width
      ? `${activeStep.message.slice(0, width - 1)}…`
      : activeStep.message;
  stdout.write(`\r\u001B[2K${frame} ${message}`);
}

function clearActiveStep(): void {
  if (activeStep?.timer) stdout.write('\r\u001B[2K');
}

function stopActiveStep(): void {
  clearActiveStep();

  if (activeStep?.timer) clearInterval(activeStep.timer);
  activeStep = undefined;
}

function colorize(value: string, color: UiColor, stream: WriteStream): string {
  if (!stream.isTTY || process.env.NO_COLOR || process.env.TERM === 'dumb')
    return value;

  const codes: Readonly<Record<UiColor, number | string>> = {
    bold: 1,
    blue: 34,
    dim: 2,
    cyan: 36,
    green: 32,
    yellow: 33,
    warningBadge: '30;43',
    red: 31,
  };

  return `\u001B[${codes[color]}m${value}\u001B[0m`;
}
