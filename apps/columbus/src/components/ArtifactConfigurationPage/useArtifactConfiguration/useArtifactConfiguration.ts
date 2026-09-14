import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useActionsDisabled,
  useOverrides,
  useSession,
} from '../../providers/index';
import {
  uniqueVersions,
  versionKey,
} from '../../../scripts/manifests/manifest-versions/manifest-versions';
import {
  createEditorDraft,
  isManifestSupportedByHost,
  resolveSelectedManifest,
} from '../../../scripts/manifests/manifest-utils/manifest-utils';
import { ARTIFACTS_ROUTE } from '../../../scripts/routing/routes/routes';
import { loadArtifactVersion } from '../../../scripts/host/atlas-host/atlas-host';
import { failureMessage } from '../../../scripts/shared/errors/errors';
import type {
  Artifact,
  ArtifactConfiguration,
  ArtifactProps,
  EditorDraft,
  ExtensionSession,
  Manifest,
} from '../../../types/app';

export function useArtifactConfiguration() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const actionsDisabled = useActionsDisabled();
  const { session } = useSession();
  const {
    message: overrideMessage,
    reportError,
    saveOverride,
    scope,
    setScope,
    status: overrideStatus,
  } = useOverrides();
  const artifact = (state as ArtifactProps | null)?.artifact;
  const configuration =
    artifact && session ? configurationOf(artifact, session) : undefined;
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

  function clearOverride(): Promise<void> {
    if (!configuration) return Promise.resolve();

    return saveOverride({
      productionManifest: configuration.productionManifest,
      selectedManifest: undefined,
    });
  }

  async function save(): Promise<void> {
    if (!configuration || !session) return;

    try {
      const selected = resolveSelectedManifest({ ...configuration, draft });
      const selectedManifest =
        selected.channel === 'local'
          ? selected
          : await loadVersion(session.tabId, configuration.key, selected);
      if (!isManifestSupportedByHost(selectedManifest, configuration.hostId))
        throw new Error(
          'Selected artifact version does not support this host.',
        );

      await saveOverride({
        productionManifest: configuration.productionManifest,
        selectedManifest,
      });
    } catch (error) {
      reportError(
        failureMessage(
          error,
          'save this artifact override',
          'Correct the selected version or URL, then retry.',
        ),
      );
    }
  }

  async function loadVersion(
    tabId: number,
    artifactKey: string,
    selected: Manifest,
  ): Promise<Manifest> {
    setLoadingVersion(true);

    try {
      return await loadArtifactVersion({
        tabId,
        artifactKey,
        versionKey: versionKey(selected),
      });
    } finally {
      setLoadingVersion(false);
    }
  }

  return {
    actionsDisabled: actionsDisabled || loadingVersion,
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
}

function configurationOf(
  { key, productionManifest }: Artifact,
  { activeOverrides, disabledOverrides, hostData }: ExtensionSession,
): ArtifactConfiguration {
  const versions = uniqueVersions([
    ...(hostData.versions[key] ?? []),
    productionManifest,
  ]);

  return {
    key,
    hostId: hostData.config.hostId,
    productionManifest,
    selectedManifest: activeOverrides.get(key) ?? disabledOverrides.get(key),
    productionOptions: versions.filter(
      (manifest) => manifest.channel === 'production',
    ),
    prOptions: versions.filter((manifest) => manifest.channel === 'pr'),
  };
}
