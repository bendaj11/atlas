import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  usePopupHost,
  usePopupOverrides,
  usePopupSession,
} from '../../context';
import { uniqueVersions, versionKey } from '../../manifest-versions';
import {
  createEditorDraft,
  resolveSelectedManifest,
} from '../../popup/manifest-utils';
import { ARTIFACTS_ROUTE } from '../../popup/popup-routes';
import type {
  ArtifactConfiguration,
  ArtifactProps,
  EditorDraft,
} from '../../popup/types';

type ArtifactConfigurationLocationState = ArtifactProps;

export function useArtifactConfiguration() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { status: hostStatus } = usePopupHost();
  const { session } = usePopupSession();
  const {
    reportError,
    saveOverride,
    scope,
    setScope,
    status: overrideStatus,
  } = usePopupOverrides();

  const hostData = session?.hostData;
  const artifact = (state as ArtifactConfigurationLocationState | null)
    ?.artifact;
  const productionManifest = artifact?.productionManifest;
  const artifactId = artifact?.id ?? '';
  const versions = artifactId ? (hostData?.versions[artifactId] ?? []) : [];
  const configuration: ArtifactConfiguration | undefined = productionManifest
    ? {
        id: artifactId,
        hostId: hostData?.config.hostId ?? '',
        allowCustomOverrides: hostData?.config.allowCustomOverrides ?? false,
        productionManifest,
        selectedManifest:
          session?.activeOverrides.get(artifactId) ??
          session?.disabledOverrides.get(artifactId),
        productionOptions: [
          productionManifest,
          ...uniqueVersions(versions).filter(
            (manifest) =>
              manifest.channel === 'production' &&
              versionKey(manifest) !== versionKey(productionManifest),
          ),
        ],
        prOptions: uniqueVersions(versions).filter(
          (manifest) => manifest.channel === 'pr',
        ),
      }
    : undefined;
  const [draft, setDraft] = useState<EditorDraft>(() =>
    createEditorDraft(configuration),
  );
  function updateDraft(changes: Partial<EditorDraft>): void {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function close(): void {
    navigate(ARTIFACTS_ROUTE);
  }

  function clearOverride(): void {
    if (!configuration) return;
    saveOverride({
      productionManifest: configuration.productionManifest,
      selectedManifest: undefined,
    });
  }

  function save(): void {
    if (!configuration) return;

    try {
      const selectedManifest = resolveSelectedManifest({
        productionManifest: configuration.productionManifest,
        draft,
        productionOptions: configuration.productionOptions,
        prOptions: configuration.prOptions,
      });
      if (
        selectedManifest?.channel === 'local' &&
        !configuration.allowCustomOverrides
      )
        throw new Error(
          'This host does not allow localhost or custom-URL overrides.',
        );
      saveOverride({
        productionManifest: configuration.productionManifest,
        selectedManifest,
      });
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    actionsDisabled: hostStatus === 'LOADING' || overrideStatus === 'APPLYING',
    clearOverride,
    close,
    configuration,
    draft,
    save,
    scope,
    setScope,
    updateDraft,
  };
}
