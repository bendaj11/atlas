import { faker } from '@faker-js/faker';
import { aStylesheet } from '@atlas/testkit';
import { ValidateStylesDriver } from './validate-styles.driver.js';

describe('validateStyles', () => {
  let driver: ValidateStylesDriver;

  beforeEach(() => {
    driver = new ValidateStylesDriver();
  });

  it('should report nothing when value is undefined', () => {
    driver.when.validated(undefined);

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when every stylesheet has a unique HTTP href and SRI integrity', () => {
    driver.when.validated([aStylesheet(), aStylesheet()]);

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when a stylesheet omits integrity', () => {
    const { integrity: _integrity, ...stylesheet } = aStylesheet();
    driver.when.validated([stylesheet]);

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report an array issue when value is not an array', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issues()).toEqual([
      { path: 'styles', message: 'Expected styles to be an array.' },
    ]);
  });

  it('should report a missing href when a stylesheet has no href', () => {
    driver.when.validated([{ integrity: aStylesheet().integrity }]);

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0.href',
        message: 'Expected href to be a non-empty string.',
      },
    ]);
  });

  it('should report a URL issue when href is relative', () => {
    driver.when.validated([aStylesheet({ href: 'styles.css' })]);

    expect(driver.get.issues()).toEqual([
      { path: 'styles.0.href', message: 'Expected an absolute HTTP(S) URL.' },
    ]);
  });

  it('should report a duplicate href when two stylesheets share one', () => {
    const stylesheet = aStylesheet();
    driver.when.validated([stylesheet, aStylesheet({ href: stylesheet.href })]);

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.1.href',
        message: `Duplicate stylesheet href "${stylesheet.href}".`,
      },
    ]);
  });

  it('should report an integrity issue when integrity is not SRI', () => {
    driver.when.validated([aStylesheet({ integrity: 'sha256-invalid' })]);

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0.integrity',
        message: 'Expected SHA-256 integrity in SRI format.',
      },
    ]);
  });
});
