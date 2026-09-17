import { faker } from '@faker-js/faker';
import {
  actionThemeMessage,
  inspectHostRequest,
  isActionThemeMessage,
  isHostDataResponse,
  isInspectHostRequest,
  isLoadArtifactVersionRequest,
  isLoadDevelopmentSessionRequest,
  isManifestResponse,
  isOverrideCountMessage,
  isRecord,
  loadArtifactVersionRequest,
  loadDevelopmentSessionRequest,
  overrideCountMessage,
} from './messages';

describe('isInspectHostRequest', () => {
  it('should accept the request when built by its constructor', () => {
    expect(isInspectHostRequest(inspectHostRequest(faker.word.noun()))).toBe(
      true,
    );
  });

  it('should reject the request when the document key is missing', () => {
    expect(isInspectHostRequest({ type: 'atlas.inspect-host' })).toBe(false);
  });
});

describe('isLoadArtifactVersionRequest', () => {
  it('should accept the request when built by its constructor', () => {
    const request = loadArtifactVersionRequest({
      artifactKey: faker.string.uuid(),
      versionKey: faker.string.uuid(),
    });

    expect(isLoadArtifactVersionRequest(request)).toBe(true);
  });

  it('should reject the request when the version key is missing', () => {
    expect(
      isLoadArtifactVersionRequest({
        type: 'atlas.load-artifact-version',
        artifactKey: faker.string.uuid(),
      }),
    ).toBe(false);
  });
});

describe('isOverrideCountMessage', () => {
  it('should accept the message when built by its constructor', () => {
    const message = overrideCountMessage(faker.number.int({ min: 0 }));

    expect(isOverrideCountMessage(message)).toBe(true);
  });

  it('should reject the message when the count is negative', () => {
    const message = overrideCountMessage(
      faker.number.int({ min: -100, max: -1 }),
    );

    expect(isOverrideCountMessage(message)).toBe(false);
  });
});

describe('isActionThemeMessage', () => {
  it.each(['dark', 'light'] as const)(
    'should accept the message when the color scheme is %s',
    (colorScheme) => {
      expect(isActionThemeMessage(actionThemeMessage(colorScheme))).toBe(true);
    },
  );

  it('should reject the message when the color scheme is unsupported', () => {
    expect(
      isActionThemeMessage({
        type: 'columbus.action-theme',
        colorScheme: faker.color.human(),
      }),
    ).toBe(false);
  });

  it('should reject the message when its type differs', () => {
    expect(isActionThemeMessage(overrideCountMessage(1))).toBe(false);
  });
});

describe('isLoadDevelopmentSessionRequest', () => {
  it('should accept the request when built by its constructor', () => {
    const request = loadDevelopmentSessionRequest({
      hostId: faker.string.uuid(),
      previewUrl: faker.internet.url(),
    });

    expect(isLoadDevelopmentSessionRequest(request)).toBe(true);
  });

  it('should reject the request when the control port is not a number', () => {
    expect(
      isLoadDevelopmentSessionRequest({
        type: 'atlas.load-development-session',
        hostId: faker.string.uuid(),
        previewUrl: faker.internet.url(),
        controlPort: String(faker.internet.port()),
      }),
    ).toBe(false);
  });
});

describe('isHostDataResponse', () => {
  it('should accept the response when it succeeded with host data', () => {
    expect(isHostDataResponse({ ok: true, hostData: {} })).toBe(true);
  });

  it('should accept the response when it failed with an error string', () => {
    expect(
      isHostDataResponse({ ok: false, error: faker.lorem.sentence() }),
    ).toBe(true);
  });
});

describe('isManifestResponse', () => {
  it('should reject the response when it succeeded without a manifest', () => {
    expect(isManifestResponse({ ok: true })).toBe(false);
  });

  it('should reject the response when it failed without an error string', () => {
    expect(isManifestResponse({ ok: false })).toBe(false);
  });
});

describe('isRecord', () => {
  it.each([{}, { a: 1 }])('should accept the value when it is %p', (value) => {
    expect(isRecord(value)).toBe(true);
  });

  it.each([null, [], 'x', 1, undefined])(
    'should reject the value when it is %p',
    (value) => {
      expect(isRecord(value)).toBe(false);
    },
  );
});
