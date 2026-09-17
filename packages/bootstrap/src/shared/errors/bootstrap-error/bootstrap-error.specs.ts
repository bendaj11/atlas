import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import {
  ArtifactUrlRejectedError,
  ArtifactVerificationFailedError,
  BootstrapError,
  BootstrapTemplateInvalidError,
  CatalogInvalidError,
  DeploymentInvalidError,
  HostManifestInvalidError,
  HostMountFailedError,
  HostRemoteInvalidError,
  ModuleLoaderUnavailableError,
  OverrideInvalidError,
  ResourceUnavailableError,
} from '../index.js';
import type { BootstrapErrorCode } from '../bootstrap-error-code.js';
import {
  BootstrapErrorDriver,
  type BootstrapErrorClass,
} from './bootstrap-error.driver.js';

const ERROR_CLASSES_BY_CODE: Record<BootstrapErrorCode, BootstrapErrorClass> = {
  DEPLOYMENT_INVALID: DeploymentInvalidError,
  CATALOG_INVALID: CatalogInvalidError,
  HOST_MANIFEST_INVALID: HostManifestInvalidError,
  ARTIFACT_URL_REJECTED: ArtifactUrlRejectedError,
  ARTIFACT_VERIFICATION_FAILED: ArtifactVerificationFailedError,
  OVERRIDE_INVALID: OverrideInvalidError,
  RESOURCE_UNAVAILABLE: ResourceUnavailableError,
  HOST_REMOTE_INVALID: HostRemoteInvalidError,
  MODULE_LOADER_UNAVAILABLE: ModuleLoaderUnavailableError,
  HOST_MOUNT_FAILED: HostMountFailedError,
  BOOTSTRAP_TEMPLATE_INVALID: BootstrapTemplateInvalidError,
};
const ERROR_CASES = Object.entries(ERROR_CLASSES_BY_CODE) as Array<
  [BootstrapErrorCode, BootstrapErrorClass]
>;

function anErrorClass(): BootstrapErrorClass {
  return faker.helpers.arrayElement(Object.values(ERROR_CLASSES_BY_CODE));
}

describe('BootstrapError', () => {
  let driver: BootstrapErrorDriver;

  beforeEach(() => {
    driver = new BootstrapErrorDriver();
  });

  it('should be an Atlas error when created', () => {
    driver.when.created({
      ErrorClass: anErrorClass(),
      message: faker.lorem.sentence(),
    });

    expect(driver.get.error()).toBeInstanceOf(AtlasError);
  });

  it('should be a bootstrap error when created', () => {
    driver.when.created({
      ErrorClass: anErrorClass(),
      message: faker.lorem.sentence(),
    });

    expect(driver.get.error()).toBeInstanceOf(BootstrapError);
  });

  it('should carry the message as summary when created', () => {
    const message = faker.lorem.sentence();
    driver.when.created({ ErrorClass: anErrorClass(), message });

    expect(driver.get.error().summary).toBe(message);
  });

  it('should preserve the cause when created with one', () => {
    const cause = new Error(faker.lorem.sentence());
    driver.when.created({
      ErrorClass: anErrorClass(),
      message: faker.lorem.sentence(),
      cause,
    });

    expect(driver.get.error().cause).toBe(cause);
  });

  it.each(ERROR_CASES)(
    'should carry the code %s when created as %p',
    (code, ErrorClass) => {
      driver.when.created({ ErrorClass, message: faker.lorem.sentence() });

      expect(driver.get.error().code).toBe(code);
    },
  );

  it.each(ERROR_CASES)(
    'should use the class name as error name when created with code %s',
    (_code, ErrorClass) => {
      driver.when.created({ ErrorClass, message: faker.lorem.sentence() });

      expect(driver.get.error().name).toBe(ErrorClass.name);
    },
  );

  it.each(ERROR_CASES)(
    'should attach at least one suggested action when the code is %s',
    (_code, ErrorClass) => {
      driver.when.created({ ErrorClass, message: faker.lorem.sentence() });

      expect(driver.get.error().suggestedActions.length).toBeGreaterThan(0);
    },
  );
});
