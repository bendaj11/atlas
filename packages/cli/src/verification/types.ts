import type { VerificationChecks } from './checks/checks.js';
import type { ExpectedContentType } from './header-checks/header-checks.js';

export interface AtlasVerifyOptions {
  hostUrl: string;
  timeoutMs?: number;
}

export interface VerificationContext {
  hostUrl: URL;
  hostOrigin: string;
  timeoutMs: number;
  checks: VerificationChecks;
}

export interface AssetExpectation {
  url: string;
  subject: string;
  integrity?: string;
  contentType: ExpectedContentType;
  inspectFederationReferences?: boolean;
}
