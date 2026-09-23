import { faker } from '@faker-js/faker';
import { SdkErrorDriver } from './sdk-error.driver.js';

describe('AtlasSdkError', () => {
  let driver: SdkErrorDriver;

  beforeEach(() => {
    driver = new SdkErrorDriver();
  });

  it('should carry the given code when created without a cause', () => {
    const code = faker.string.alpha({ length: 12, casing: 'upper' });

    driver.when.sdkErrorCreated(faker.lorem.sentence(), code);

    expect(driver.get.error()).toEqual(expect.objectContaining({ code }));
  });

  it('should report the browser surface when created', () => {
    driver.when.sdkErrorCreated(faker.lorem.sentence(), 'ATLAS_SDK_FAILED');

    expect(driver.get.error()).toEqual(
      expect.objectContaining({ surface: 'browser' }),
    );
  });

  it('should name itself AtlasSdkError when created', () => {
    driver.when.sdkErrorCreated(faker.lorem.sentence(), 'ATLAS_SDK_FAILED');

    expect(driver.get.error().name).toBe('AtlasSdkError');
  });

  it('should leave the cause unset when no cause is given', () => {
    driver.when.sdkErrorCreated(faker.lorem.sentence(), 'ATLAS_SDK_FAILED');

    expect(driver.get.cause()).toBeUndefined();
  });

  it('should keep the cause when a cause is given', () => {
    const cause = new Error(faker.lorem.sentence());

    driver.when.sdkErrorCreatedWithCause(faker.lorem.sentence(), cause);

    expect(driver.get.cause()).toBe(cause);
  });
});

describe('AtlasWidgetMountError', () => {
  let driver: SdkErrorDriver;

  beforeEach(() => {
    driver = new SdkErrorDriver();
  });

  it('should report ATLAS_WIDGET_MOUNT_FAILED when created', () => {
    driver.when.widgetMountErrorCreated(
      faker.string.uuid(),
      new Error(faker.lorem.sentence()),
    );

    expect(driver.get.error()).toEqual(
      expect.objectContaining({ code: 'ATLAS_WIDGET_MOUNT_FAILED' }),
    );
  });

  it('should include the widget id in the summary when created', () => {
    const widgetId = faker.string.uuid();

    driver.when.widgetMountErrorCreated(widgetId, new Error('boom'));

    expect(driver.get.error().message).toContain(widgetId);
  });

  it('should keep the thrown error as the cause when the cause is an Error', () => {
    const cause = new Error(faker.lorem.sentence());

    driver.when.widgetMountErrorCreated(faker.string.uuid(), cause);

    expect(driver.get.cause()).toBe(cause);
  });

  it('should wrap a non-Error cause in an Error when the cause is not an Error', () => {
    const cause = faker.lorem.sentence();

    driver.when.widgetMountErrorCreated(faker.string.uuid(), cause);

    expect(driver.get.cause()).toEqual(new Error(cause));
  });
});

describe('AtlasEventListenerError', () => {
  let driver: SdkErrorDriver;

  beforeEach(() => {
    driver = new SdkErrorDriver();
  });

  it('should report ATLAS_EVENT_LISTENER_FAILED when created', () => {
    driver.when.eventListenerErrorCreated(new Error(faker.lorem.sentence()));

    expect(driver.get.error()).toEqual(
      expect.objectContaining({ code: 'ATLAS_EVENT_LISTENER_FAILED' }),
    );
  });

  it('should include the listener failure message in the summary when created', () => {
    const message = faker.lorem.sentence();

    driver.when.eventListenerErrorCreated(new Error(message));

    expect(driver.get.error().message).toContain(message);
  });

  it('should wrap a non-Error cause in an Error when the cause is not an Error', () => {
    const cause = faker.lorem.sentence();

    driver.when.eventListenerErrorCreated(cause);

    expect(driver.get.cause()).toEqual(new Error(cause));
  });
});
