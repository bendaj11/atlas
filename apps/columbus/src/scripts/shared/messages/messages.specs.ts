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

describe('extension messages', () => {
  it('should recognize an inspect host request it built', () => {
    expect(isInspectHostRequest(inspectHostRequest('key'))).toBe(true);
  });

  it('should reject an inspect host request without a document key', () => {
    expect(isInspectHostRequest({ type: 'atlas.inspect-host' })).toBe(false);
  });

  it('should recognize a load artifact version request it built', () => {
    expect(
      isLoadArtifactVersionRequest(loadArtifactVersionRequest('app:a', 'v')),
    ).toBe(true);
  });

  it('should reject a load artifact version request missing the version key', () => {
    expect(
      isLoadArtifactVersionRequest({
        type: 'atlas.load-artifact-version',
        artifactKey: 'a',
      }),
    ).toBe(false);
  });

  it('should recognize an override count message it built', () => {
    expect(isOverrideCountMessage(overrideCountMessage(2))).toBe(true);
  });

  it('should reject a negative override count', () => {
    expect(isOverrideCountMessage(overrideCountMessage(-1))).toBe(false);
  });

  it('should recognize an action theme message it built', () => {
    expect(isActionThemeMessage(actionThemeMessage('dark'))).toBe(true);
  });

  it('should reject an unsupported color scheme', () => {
    expect(
      isActionThemeMessage({
        type: 'columbus.action-theme',
        colorScheme: 'sepia',
      }),
    ).toBe(false);
  });

  it('should reject a message of another type', () => {
    expect(isActionThemeMessage(overrideCountMessage(1))).toBe(false);
  });

  it('should recognize a development session request it built', () => {
    expect(
      isLoadDevelopmentSessionRequest(
        loadDevelopmentSessionRequest({
          hostId: 'h',
          previewUrl: 'http://localhost',
        }),
      ),
    ).toBe(true);
  });

  it('should reject a development session request with a non-numeric port', () => {
    expect(
      isLoadDevelopmentSessionRequest({
        type: 'atlas.load-development-session',
        hostId: 'h',
        previewUrl: 'http://localhost',
        controlPort: '4400',
      }),
    ).toBe(false);
  });
});

describe('content responses', () => {
  it('should accept a successful host data response', () => {
    expect(isHostDataResponse({ ok: true, hostData: {} })).toBe(true);
  });

  it('should accept a failed response with an error', () => {
    expect(isHostDataResponse({ ok: false, error: 'nope' })).toBe(true);
  });

  it('should reject a successful response without its payload', () => {
    expect(isManifestResponse({ ok: true })).toBe(false);
  });

  it('should reject a failed response without an error string', () => {
    expect(isManifestResponse({ ok: false })).toBe(false);
  });
});

describe('isRecord', () => {
  it.each([{}, { a: 1 }])('should accept %p', (value) => {
    expect(isRecord(value)).toBe(true);
  });

  it.each([null, [], 'x', 1, undefined])('should reject %p', (value) => {
    expect(isRecord(value)).toBe(false);
  });
});
