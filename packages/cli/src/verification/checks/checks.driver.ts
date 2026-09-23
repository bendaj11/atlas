import { VerificationChecks } from './checks.js';

export class ChecksDriver {
  private readonly checks = new VerificationChecks();

  readonly given = {
    pass: (subject: string, message: string) => {
      this.checks.pass(subject, message);

      return this;
    },
    warning: (subject: string, message: string) => {
      this.checks.warn(subject, message);

      return this;
    },
    failure: (subject: string, message: string) => {
      this.checks.fail(subject, message);

      return this;
    },
  };

  readonly get = {
    report: (hostUrl: string, hostId?: string) =>
      this.checks.report(hostUrl, hostId),
  };
}
