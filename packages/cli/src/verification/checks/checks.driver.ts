import { VerificationChecks, type AtlasVerificationReport } from './checks.js';

export class ChecksDriver {
  private readonly checks = new VerificationChecks();

  readonly given = {
    pass: (subject: string, message: string): this => {
      this.checks.pass(subject, message);

      return this;
    },
    warning: (subject: string, message: string): this => {
      this.checks.warn(subject, message);

      return this;
    },
    failure: (subject: string, message: string): this => {
      this.checks.fail(subject, message);

      return this;
    },
  };

  readonly get = {
    report: (hostUrl: string, hostId?: string): AtlasVerificationReport =>
      this.checks.report(hostUrl, hostId),
  };
}
