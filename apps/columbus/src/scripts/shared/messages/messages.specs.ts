import {
  actionThemeMessage,
  inspectHostRequest,
  loadArtifactVersionRequest,
  loadDevelopmentSessionRequest,
  overrideCountMessage,
} from './messages';
import { MessagesDriver } from './messages.driver';

describe('extension message guards', () => {
  let driver: MessagesDriver;

  beforeEach(() => {
    driver = new MessagesDriver();
  });

  it('should accept an inspect host request when built by its constructor', () => {
    driver.when.checked('inspectHostRequest', inspectHostRequest('key'));

    expect(driver.get.result()).toBe(true);
  });

  it('should reject an inspect host request when the document key is missing', () => {
    driver.when.checked('inspectHostRequest', { type: 'atlas.inspect-host' });

    expect(driver.get.result()).toBe(false);
  });

  it('should accept a load artifact version request when built by its constructor', () => {
    driver.when.checked(
      'loadArtifactVersionRequest',
      loadArtifactVersionRequest({ artifactKey: 'app:a', versionKey: 'v' }),
    );

    expect(driver.get.result()).toBe(true);
  });

  it('should reject a load artifact version request when the version key is missing', () => {
    driver.when.checked('loadArtifactVersionRequest', {
      type: 'atlas.load-artifact-version',
      artifactKey: 'a',
    });

    expect(driver.get.result()).toBe(false);
  });

  it('should accept an override count message when built by its constructor', () => {
    driver.when.checked('overrideCountMessage', overrideCountMessage(2));

    expect(driver.get.result()).toBe(true);
  });

  it('should reject an override count message when the count is negative', () => {
    driver.when.checked('overrideCountMessage', overrideCountMessage(-1));

    expect(driver.get.result()).toBe(false);
  });

  it('should accept an action theme message when built by its constructor', () => {
    driver.when.checked('actionThemeMessage', actionThemeMessage('dark'));

    expect(driver.get.result()).toBe(true);
  });

  it('should reject an action theme message when the color scheme is unsupported', () => {
    driver.when.checked('actionThemeMessage', {
      type: 'columbus.action-theme',
      colorScheme: 'sepia',
    });

    expect(driver.get.result()).toBe(false);
  });

  it('should reject a message when its type differs', () => {
    driver.when.checked('actionThemeMessage', overrideCountMessage(1));

    expect(driver.get.result()).toBe(false);
  });

  it('should accept a development session request when built by its constructor', () => {
    driver.when.checked(
      'loadDevelopmentSessionRequest',
      loadDevelopmentSessionRequest({
        hostId: 'h',
        previewUrl: 'http://localhost',
      }),
    );

    expect(driver.get.result()).toBe(true);
  });

  it('should reject a development session request when the port is not a number', () => {
    driver.when.checked('loadDevelopmentSessionRequest', {
      type: 'atlas.load-development-session',
      hostId: 'h',
      previewUrl: 'http://localhost',
      controlPort: '4400',
    });

    expect(driver.get.result()).toBe(false);
  });
});

describe('content response guards', () => {
  let driver: MessagesDriver;

  beforeEach(() => {
    driver = new MessagesDriver();
  });

  it('should accept a host data response when it succeeded with data', () => {
    driver.when.checked('hostDataResponse', { ok: true, hostData: {} });

    expect(driver.get.result()).toBe(true);
  });

  it('should accept a response when it failed with an error string', () => {
    driver.when.checked('hostDataResponse', { ok: false, error: 'nope' });

    expect(driver.get.result()).toBe(true);
  });

  it('should reject a manifest response when it succeeded without a manifest', () => {
    driver.when.checked('manifestResponse', { ok: true });

    expect(driver.get.result()).toBe(false);
  });

  it('should reject a response when it failed without an error string', () => {
    driver.when.checked('manifestResponse', { ok: false });

    expect(driver.get.result()).toBe(false);
  });
});

describe('isRecord', () => {
  let driver: MessagesDriver;

  beforeEach(() => {
    driver = new MessagesDriver();
  });

  it.each([{}, { a: 1 }])('should accept the value when it is %p', (value) => {
    driver.when.checked('record', value);

    expect(driver.get.result()).toBe(true);
  });

  it.each([null, [], 'x', 1, undefined])(
    'should reject the value when it is %p',
    (value) => {
      driver.when.checked('record', value);

      expect(driver.get.result()).toBe(false);
    },
  );
});
