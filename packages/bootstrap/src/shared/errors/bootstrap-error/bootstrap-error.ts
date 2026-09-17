import { AtlasError } from '@atlas/schema';
import type { BootstrapErrorCode } from '../bootstrap-error-code.js';
import { SUGGESTED_ACTIONS } from '../suggested-actions.js';

export interface BootstrapErrorCause {
  cause?: unknown;
}

export abstract class BootstrapError extends AtlasError {
  constructor({
    code,
    message,
    cause,
  }: BootstrapErrorCause & {
    code: BootstrapErrorCode;
    message: string;
  }) {
    super(message, {
      code,
      suggestedActions: SUGGESTED_ACTIONS[code],
      ...(cause === undefined ? {} : { cause }),
    });

    this.name = new.target.name;
  }
}

export class DeploymentInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'DEPLOYMENT_INVALID', message, ...options });
  }
}

export class CatalogInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'CATALOG_INVALID', message, ...options });
  }
}

export class HostManifestInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'HOST_MANIFEST_INVALID', message, ...options });
  }
}

export class ArtifactUrlRejectedError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'ARTIFACT_URL_REJECTED', message, ...options });
  }
}

export class ArtifactVerificationFailedError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'ARTIFACT_VERIFICATION_FAILED', message, ...options });
  }
}

export class OverrideInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'OVERRIDE_INVALID', message, ...options });
  }
}

export class ResourceUnavailableError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'RESOURCE_UNAVAILABLE', message, ...options });
  }
}

export class HostRemoteInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'HOST_REMOTE_INVALID', message, ...options });
  }
}

export class ModuleLoaderUnavailableError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'MODULE_LOADER_UNAVAILABLE', message, ...options });
  }
}

export class HostMountFailedError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'HOST_MOUNT_FAILED', message, ...options });
  }
}

export class BootstrapTemplateInvalidError extends BootstrapError {
  constructor(message: string, options: BootstrapErrorCause = {}) {
    super({ code: 'BOOTSTRAP_TEMPLATE_INVALID', message, ...options });
  }
}
