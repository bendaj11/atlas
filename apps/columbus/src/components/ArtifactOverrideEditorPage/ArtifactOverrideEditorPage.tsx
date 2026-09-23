import { Box, Heading, Page, Text } from '@wix/design-system';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ARTIFACTS_ROUTE } from '../../routing/routes/routes';
import { baseUrlFromRemoteEntry } from '../../utils/artifact-version-utils/artifact-version-utils';
import { versionKey } from '../../utils/artifact-version-keys/artifact-version-keys';
import type { OverrideSelection } from '../../types/artifact';
import type { ArtifactVersion } from '../../types/artifact-version';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker/BrowserOverrideScopePicker';
import {
  useActionsDisabled,
  useColumbusState,
  useOverrides,
} from '../../hooks';
import { useArtifactOverrideOptions } from './hooks/useArtifactOverrideOptions/useArtifactOverrideOptions';
import { useSaveArtifactOverrideMutation } from './hooks/useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation';
import { useHostArtifactVersionQuery } from './hooks/useHostArtifactVersionQuery/useHostArtifactVersionQuery';
import { failureMessage } from '../../utils/errors/errors';
import { OverridesSelectionForm } from './OverridesForm/OverridesSelectionForm';
import { ArtifactOverrideEditorPageActions } from './ArtifactOverrideEditorPageActions/ArtifactOverrideEditorPageActions';

export function ArtifactOverrideEditorPage() {
  const navigate = useNavigate();
  const overrideOptions = useArtifactOverrideOptions();
  const { columbusState } = useColumbusState();
  const hostId = columbusState?.hostData.config.hostId;
  const { clearOverride, message, scope, setScope, status } = useOverrides();
  const actionsDisabled = useActionsDisabled();
  const [selection, setSelection] = useState(() =>
    initialOverrideSelection(overrideOptions?.selectedOverrideArtifactVersion),
  );
  const hostArtifactVersion = useHostArtifactVersionQuery({
    overrideOptions,
    selection,
  });
  const { error, isPending, mutate } = useSaveArtifactOverrideMutation({
    overrideOptions,
    hostId,
    selection,
    hostArtifactVersion: hostArtifactVersion.data,
  });

  if (!overrideOptions || !hostId)
    return <Navigate to={ARTIFACTS_ROUTE} replace />;

  const disabled = actionsDisabled || isPending;
  const saveDisabled =
    disabled || (selection.type !== 'custom' && !hostArtifactVersion.data);
  const failure = error ?? hostArtifactVersion.error;
  const errorMessage = failure
    ? failureMessage(
        failure,
        'save this artifact override',
        'Correct the selected version or URL, then retry.',
      )
    : status === 'ERROR'
      ? message
      : undefined;

  function close(): void {
    navigate(ARTIFACTS_ROUTE);
  }

  return (
    <Page minWidth={0}>
      <Page.Header
        showBackButton
        onBackClicked={close}
        subtitle={
          <Text secondary size="small">
            Choose override source
          </Text>
        }
        title={
          <Heading dataHook="artifact-override-title" size="medium">
            {overrideOptions.deployedArtifactVersion.name}
          </Heading>
        }
        actionsBar={
          <ArtifactOverrideEditorPageActions
            onSave={() => mutate()}
            onCancel={close}
            onClear={() =>
              void clearOverride(overrideOptions.deployedArtifactVersion.id)
            }
            saveDisabled={saveDisabled}
            cancelDisabled={disabled}
            clearDisabled={
              disabled || !overrideOptions.selectedOverrideArtifactVersion
            }
          />
        }
      />

      <Page.Content>
        <Box direction="vertical" gap="SP4">
          {errorMessage && (
            <Text dataHook="artifact-override-error" role="alert" skin="error">
              {errorMessage}
            </Text>
          )}

          <BrowserOverrideScopePicker
            selectedScope={scope}
            onChange={setScope}
            disabled={disabled}
          />

          <OverridesSelectionForm
            selection={selection}
            overrideOptions={overrideOptions}
            hostId={hostId}
            onChange={setSelection}
          />
        </Box>
      </Page.Content>
    </Page>
  );
}

function initialOverrideSelection(
  selectedOverrideArtifactVersion: ArtifactVersion | undefined,
): OverrideSelection {
  if (!selectedOverrideArtifactVersion) return { type: 'custom', value: '' };
  if (selectedOverrideArtifactVersion.channel === 'local')
    return {
      type: 'custom',
      value: baseUrlFromRemoteEntry(
        selectedOverrideArtifactVersion.remoteEntryUrl,
      ),
    };

  return {
    type: selectedOverrideArtifactVersion.channel,
    value: versionKey(selectedOverrideArtifactVersion),
  };
}
