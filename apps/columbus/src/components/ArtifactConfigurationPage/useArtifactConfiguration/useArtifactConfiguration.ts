import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHost, useOverrides, useSession } from '../../providers/index.js';
import { uniqueVersionsInOrder } from '../../../scripts/manifests/manifest-versions/manifest-versions.js';
import {
  createEditorDraft,
  isManifestSupportedByHost,
  resolveSelectedManifest,
} from '../../../scripts/manifests/manifest-utils/manifest-utils.js';
import { ARTIFACTS_ROUTE } from '../../../scripts/routing/routes/routes.js';
import {
  errorMessage,
  loadArtifactVersion,
} from '../../../scripts/host/atlas-host/atlas-host.js';
import { versionKey } from '../../../scripts/manifests/manifest-versions/manifest-versions.js';
import type {
  ArtifactConfiguration,
  ArtifactProps,
  EditorDraft,
} from '../../../types/app.js';

type ArtifactConfigurationLocationState = ArtifactProps;

export function useArtifactConfiguration() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { status: hostStatus } = useHost();
  const { session } = useSession();
  const {
    message: overrideMessage,
    reportError,
    saveOverride,
    scope,
    setScope,
    status: overrideStatus,
  } = useOverrides();

  const hostData = session?.hostData;
  const tabId = session?.tabId;
  const artifact = (state as ArtifactConfigurationLocationState | null)
    ?.artifact;
  const productionManifest = artifact?.productionManifest;
  const artifactId = artifact?.id ?? '';
  const versions = artifactId ? (hostData?.versions[artifactId] ?? []) : [];
  const uniqueArtifactVersions = uniqueVersionsInOrder(versions);
  const configuration: ArtifactConfiguration | undefined = productionManifest
    ? {
        id: artifactId,
        hostId: hostData?.config.hostId ?? '',
        productionManifest,
        selectedManifest:
          session?.activeOverrides.get(artifactId) ??
          session?.disabledOverrides.get(artifactId),
        productionOptions: uniqueVersionsInOrder([
          ...uniqueArtifactVersions,
          productionManifest,
        ]).filter((manifest) => manifest.channel === 'production'),
        prOptions: uniqueArtifactVersions.filter(
          (manifest) => manifest.channel === 'pr',
        ),
      }
    : undefined;
  const [draft, setDraft] = useState<EditorDraft>(() =>
    createEditorDraft(configuration),
  );
  const [loadingVersion, setLoadingVersion] = useState(false);
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

  async function save(): Promise<void> {
    if (!configuration) return;

    try {
      const selected = resolveSelectedManifest({
        productionManifest: configuration.productionManifest,
        draft,
        productionOptions: configuration.productionOptions,
        prOptions: configuration.prOptions,
      });
      if (!selected) throw new Error('Choose an artifact version.');
      const selectedManifest =
        selected.channel === 'local'
          ? selected
          : await fetchSelectedArtifactVersion(selected);
      if (!isManifestSupportedByHost(selectedManifest, configuration.hostId))
        throw new Error(
          'Selected artifact version does not support this host.',
        );
      saveOverride({
        productionManifest: configuration.productionManifest,
        selectedManifest,
      });
    } catch (error) {
      reportError(
        errorMessage(
          error,
          'save this artifact override',
          'Correct the selected version or URL, then retry.',
        ),
      );
    }
  }

  return {
    actionsDisabled:
      hostStatus === 'LOADING' ||
      overrideStatus === 'APPLYING' ||
      loadingVersion,
    clearOverride,
    close,
    configuration,
    draft,
    errorMessage: overrideStatus === 'ERROR' ? overrideMessage : undefined,
    save,
    scope,
    setScope,
    updateDraft,
  };

  async function fetchSelectedArtifactVersion(
    selected: NonNullable<ReturnType<typeof resolveSelectedManifest>>,
  ) {
    if (!tabId) throw new Error('Active Atlas host tab is unavailable.');
    setLoadingVersion(true);
    try {
      return await loadArtifactVersion({
        tabId,
        artifactKey: artifactId,
        versionKey: versionKey(selected),
      });
    } finally {
      setLoadingVersion(false);
    }
  }
}
