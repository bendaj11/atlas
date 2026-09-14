import { ErrorsDriver } from './errors.driver';

describe('messageFromError', () => {
  let driver: ErrorsDriver;

  beforeEach(() => {
    driver = new ErrorsDriver();
  });

  it('should use the error message when given an Error', () => {
    driver.when.messageExtracted(new Error('Boom'));

    expect(driver.get.message()).toBe('Boom');
  });

  it('should stringify the value when given a non-Error', () => {
    driver.when.messageExtracted(404);

    expect(driver.get.message()).toBe('404');
  });
});

describe('failureMessage', () => {
  let driver: ErrorsDriver;

  beforeEach(() => {
    driver = new ErrorsDriver();
  });

  it('should describe operation, detail, and action when all are given', () => {
    driver.when.failureDescribed(
      new Error('Tab gone.'),
      'read the host',
      'Retry.',
    );

    expect(driver.get.message()).toBe(
      'Columbus could not read the host: Tab gone. Suggested action: Retry.',
    );
  });

  it('should strip a nested suggested action when the detail already has one', () => {
    driver.when.failureDescribed(
      new Error('Tab gone. Suggested action: Old advice.'),
      'read',
      'New.',
    );

    expect(driver.get.message()).toBe(
      'Columbus could not read: Tab gone. Suggested action: New.',
    );
  });

  it('should use generic wording when only the error is given', () => {
    driver.when.failureDescribed('oops');

    expect(driver.get.message()).toBe(
      'Columbus could not complete the requested action: oops Suggested action: Reload the Atlas host page, reopen Columbus, and retry.',
    );
  });
});
