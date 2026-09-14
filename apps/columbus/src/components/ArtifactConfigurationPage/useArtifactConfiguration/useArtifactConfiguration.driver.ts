import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { useLocation as useLocationType } from 'react-router-dom';
import type {
  Artifact,
  EditorDraft,
  ExtensionSession,
  Manifest,
  OverrideStatus,
} from '../../../types/app';
import { aManifest, anArtifact, aSession } from '../../../types/app.testkit';
import type { requestArtifactVersion as requestArtifactVersionType } from '../../../scripts/host/host-tabs/host-tabs';
import type {
  useActionsDisabled as useActionsDisabledType,
  useOverrides as useOverridesType,
  useSession as useSessionType,
} from '../../providers/index';

const navigate = jest.fn();
const useLocation = jest.fn<typeof useLocationType>();
const useActionsDisabled = jest.fn<typeof useActionsDisabledType>();
const useOverrides = jest.fn<typeof useOverridesType>();
const useSession = jest.fn<typeof useSessionType>();
const requestArtifactVersion = jest.fn<typeof requestArtifactVersionType>();

jest.unstable_mockModule('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation,
}));
jest.unstable_mockModule('../../providers', () => ({
  useActionsDisabled,
  useOverrides,
  useSession,
}));
jest.unstable_mockModule('../../../scripts/host/host-tabs/host-tabs', () => ({
  requestArtifactVersion,
}));

const { useArtifactConfiguration } = await import('./useArtifactConfiguration');

type HookResult = ReturnType<typeof useArtifactConfiguration>;
type OverridesValue = ReturnType<typeof useOverridesType>;
type SessionValue = ReturnType<typeof useSessionType>;

export class UseArtifactConfigurationDriver {
  private readonly session: ExtensionSession = aSession();
  private readonly production = aManifest({
    id: 'orders',
    version: '1.0.0',
    buildId: 'prod-1',
    supportedHosts: ['*'],
  });
  private artifact: Artifact | undefined = anArtifact({
    key: 'orders-artifact',
    productionManifest: this.production,
  });
  private actionsDisabled = false;
  private overrideStatus: OverrideStatus = 'IDLE';
  private overrideMessage = '';
  private readonly saveOverride = jest.fn<OverridesValue['saveOverride']>();
  private readonly reportError = jest.fn<OverridesValue['reportError']>();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  readonly given = {
    artifact: (artifact: Artifact | undefined): this => {
      this.artifact = artifact;

      return this;
    },
    version: (version: Manifest): this => {
      const versions = this.session.hostData.versions;
      versions[this.artifactId()] = [
        ...(versions[this.artifactId()] ?? []),
        version,
      ];

      return this;
    },
    activeOverride: (artifactId: string, override: Manifest): this => {
      this.session.activeOverrides.set(artifactId, override);

      return this;
    },
    disabledOverride: (artifactId: string, override: Manifest): this => {
      this.session.disabledOverrides.set(artifactId, override);

      return this;
    },
    actionsDisabled: (disabled: boolean): this => {
      this.actionsDisabled = disabled;

      return this;
    },
    overrideStatus: (status: OverrideStatus, message = ''): this => {
      this.overrideStatus = status;
      this.overrideMessage = message;

      return this;
    },
    loadedVersion: (manifest: Manifest): this => {
      requestArtifactVersion.mockResolvedValue(manifest);

      return this;
    },
    versionLoadFailure: (reason: string): this => {
      requestArtifactVersion.mockRejectedValue(new Error(reason));

      return this;
    },
    pendingVersionLoad: (): this => {
      requestArtifactVersion.mockReturnValue(new Promise(() => {}));

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useLocation.mockReturnValue({
        state: this.artifact ? { artifact: this.artifact } : null,
      } as ReturnType<typeof useLocationType>);
      useActionsDisabled.mockReturnValue(this.actionsDisabled);
      useSession.mockReturnValue({ session: this.session } as SessionValue);
      useOverrides.mockReturnValue({
        message: this.overrideMessage,
        status: this.overrideStatus,
        scope: 'all',
        reportError: this.reportError,
        saveOverride: this.saveOverride,
        setScope: () => {},
      } as Partial<OverridesValue> as OverridesValue);
      this.hook = renderHook(() => useArtifactConfiguration());

      return this;
    },
    draftUpdated: (changes: Partial<EditorDraft>): this => {
      act(() => this.get.result().updateDraft(changes));

      return this;
    },
    closed: (): this => {
      act(() => this.get.result().close());

      return this;
    },
    overrideCleared: (): this => {
      act(() => this.get.result().clearOverride());

      return this;
    },
    saved: async (): Promise<this> => {
      await act(() => this.get.result().save());

      return this;
    },
    saveStarted: (): this => {
      act(() => void this.get.result().save());

      return this;
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    configuration: () => this.get.result().configuration,
    draft: (): EditorDraft => this.get.result().draft,
    actionsDisabled: (): boolean => this.get.result().actionsDisabled,
    errorMessage: (): string | undefined => this.get.result().errorMessage,
    navigatedTo: (): unknown => navigate.mock.calls[0]?.[0],
    savedSelection: () => this.saveOverride.mock.calls[0]?.[0],
    reportedError: (): string | undefined =>
      this.reportError.mock.calls[0]?.[0],
    versionLoadRequest: () => requestArtifactVersion.mock.calls[0],
    versionLoadCount: (): number => requestArtifactVersion.mock.calls.length,
    productionManifest: (): Manifest => this.production,
    tabId: (): number => this.session.tabId,
    hostId: (): string => this.session.hostData.config.hostId,
  };

  private artifactId(): string {
    return 'orders-artifact';
  }
}
