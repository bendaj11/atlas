import { PassThrough } from 'node:stream';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { captureProcessOutput } from './process.js';

export class CliProcessDriver {
  private readonly stdoutText = faker.lorem.sentence();
  private readonly stderrText = faker.lorem.sentence();
  private readonly stdout = new PassThrough();
  private readonly stderr = new PassThrough();
  private readonly writeStdout =
    jest.fn<(...arguments_: unknown[]) => boolean>();
  private readonly writeStderr =
    jest.fn<(...arguments_: unknown[]) => boolean>();
  private readOutput?: () => string;

  when = {
    capture: (): void => {
      this.readOutput = captureProcessOutput(
        { stderr: this.stderr, stdout: this.stdout },
        {
          stderr: { write: this.writeStderr },
          stdout: { write: this.writeStdout },
        },
      );

      this.stdout.write(this.stdoutText);
      this.stderr.write(this.stderrText);
    },
  };

  get = {
    capturedOutput: (): string => this.readOutput?.() ?? '',
    expectedOutput: (): string => `${this.stdoutText}${this.stderrText}`,
  };
}
