export type AtlasVerificationStatus = 'pass' | 'warning' | 'failure';

export interface AtlasVerificationCheck {
  status: AtlasVerificationStatus;
  subject: string;
  message: string;
}

export interface AtlasVerificationReport {
  hostUrl: string;
  hostId?: string;
  checks: AtlasVerificationCheck[];
  failures: number;
  warnings: number;
}

export class VerificationChecks {
  private readonly checks: AtlasVerificationCheck[] = [];

  pass(subject: string, message: string): void {
    this.checks.push({ status: 'pass', subject, message });
  }

  warn(subject: string, message: string): void {
    this.checks.push({ status: 'warning', subject, message });
  }

  fail(subject: string, message: string): void {
    this.checks.push({ status: 'failure', subject, message });
  }

  report(hostUrl: string, hostId?: string): AtlasVerificationReport {
    return {
      hostUrl,
      ...(hostId ? { hostId } : {}),
      checks: [...this.checks],
      failures: this.count('failure'),
      warnings: this.count('warning'),
    };
  }

  private count(status: AtlasVerificationStatus): number {
    return this.checks.filter((check) => check.status === status).length;
  }
}
