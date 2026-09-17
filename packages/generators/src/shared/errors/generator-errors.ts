import { AtlasError } from '@atlas/schema';

const MAX_ATLAS_ID_LENGTH = 214;

export class InvalidGeneratorIdError extends AtlasError {
  constructor(options: { field: 'name' | 'host id'; value: string }) {
    super(`Invalid ${options.field} "${options.value}".`, {
      suggestedActions: `Use 1-${MAX_ATLAS_ID_LENGTH} lowercase letters, numbers, and single hyphens between words, for example "orders-app".`,
      code: 'ATLAS_GENERATOR_INVALID_ID',
    });
    this.name = 'InvalidGeneratorIdError';
  }
}

export class UnsupportedGeneratorFrameworkError extends AtlasError {
  constructor(framework: string) {
    super(`Unsupported Atlas generator framework "${framework}".`, {
      suggestedActions: 'Pass --framework=angular or --framework=react.',
      code: 'ATLAS_GENERATOR_UNSUPPORTED_FRAMEWORK',
    });
    this.name = 'UnsupportedGeneratorFrameworkError';
  }
}

export class InvalidFrameworkVersionError extends AtlasError {
  constructor(options: { framework: 'React' | 'Angular'; version: string }) {
    const example =
      options.framework === 'React'
        ? 'a React version or range, for example 19.2.8 or ^19.0.0'
        : 'an Angular version or range, for example 20.3.0 or ^20.0.0';
    super(
      `Invalid ${options.framework} framework version "${options.version}".`,
      {
        suggestedActions: `Pass --framework-version with ${example}.`,
        code: 'ATLAS_GENERATOR_INVALID_VERSION',
      },
    );
    this.name = 'InvalidFrameworkVersionError';
  }
}

export class UnverifiedFrameworkVersionError extends AtlasError {
  constructor(options: {
    framework: 'React' | 'Angular';
    major: number;
    verifiedMajors: readonly number[];
  }) {
    super(`${options.framework} ${options.major} is not verified by Atlas.`, {
      suggestedActions: [
        `Pass --framework-version with a verified ${options.framework} major (${options.verifiedMajors.join(', ')}).`,
        'Pass --allow-unsupported-version to generate it anyway with the nearest verified companion versions.',
      ],
      code: 'ATLAS_GENERATOR_UNVERIFIED_VERSION',
    });
    this.name = 'UnverifiedFrameworkVersionError';
  }
}

export { MAX_ATLAS_ID_LENGTH };
