import { faker } from '@faker-js/faker';
import {
  aGeneratorOptions,
  anAtlasId,
} from '../../testkit/generator-options.testkit.js';
import { ValidationDriver } from './validation.driver.js';

const INVALID_IDS = [
  'Orders',
  'orders_app',
  'orders.app',
  '-orders',
  'orders-',
  'orders--app',
  '',
];
const ID_ACTION =
  'Suggested action: Use 1-214 lowercase letters, numbers, and single hyphens between words, for example "orders-app".';

describe('validateGeneratorOptions', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
  });

  it('should pass when name, host id and framework are valid', () => {
    driver.given.options(aGeneratorOptions({ hostId: anAtlasId() }));

    expect(() => driver.when.validated()).not.toThrow();
  });

  it('should pass when host id is omitted', () => {
    driver.given.options(aGeneratorOptions({ hostId: undefined }));

    expect(() => driver.when.validated()).not.toThrow();
  });

  it.each(INVALID_IDS)('should throw when name is "%s"', (name) => {
    driver.given.options(aGeneratorOptions({ name }));

    expect(() => driver.when.validated()).toThrow(
      `Invalid name "${name}". ${ID_ACTION}`,
    );
  });

  it('should throw when name is longer than 214 characters', () => {
    const name = faker.string.alpha({ length: 215, casing: 'lower' });
    driver.given.options(aGeneratorOptions({ name }));

    expect(() => driver.when.validated()).toThrow(`Invalid name "${name}".`);
  });

  it.each(INVALID_IDS)('should throw when host id is "%s"', (hostId) => {
    driver.given.options(aGeneratorOptions({ hostId }));

    expect(() => driver.when.validated()).toThrow(
      `Invalid host id "${hostId}". ${ID_ACTION}`,
    );
  });

  it('should throw when framework is not angular or react', () => {
    driver.given.options(aGeneratorOptions({ framework: 'vue' }));

    expect(() => driver.when.validated()).toThrow(
      'Unsupported Atlas generator framework "vue". Suggested action: Pass --framework=angular or --framework=react.',
    );
  });

  it('should throw when framework is angular and framework version is not verified', () => {
    driver.given.options(
      aGeneratorOptions({ framework: 'angular', frameworkVersion: '18.0.0' }),
    );

    expect(() => driver.when.validated()).toThrow(
      'Angular 18 is not verified by Atlas.',
    );
  });

  it('should throw when framework is react and framework version is not verified', () => {
    driver.given.options(
      aGeneratorOptions({ framework: 'react', frameworkVersion: '16.0.0' }),
    );

    expect(() => driver.when.validated()).toThrow(
      'React 16 is not verified by Atlas.',
    );
  });
});

describe('assertValidGeneratorName', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
  });

  it('should pass when name is a lowercase hyphenated id', () => {
    driver.given.options(aGeneratorOptions({ name: anAtlasId() }));

    expect(() => driver.when.nameValidated()).not.toThrow();
  });

  it('should throw when name is not a lowercase hyphenated id', () => {
    driver.given.options(aGeneratorOptions({ name: 'Orders' }));

    expect(() => driver.when.nameValidated()).toThrow(
      `Invalid name "Orders". ${ID_ACTION}`,
    );
  });
});
