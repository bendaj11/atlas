import { Box, Heading, Page, Text } from '@wix/design-system';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ARTIFACTS_ROUTE } from '../../scripts/routing/routes/routes';
import { initialOverrideSelection } from '../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker/BrowserOverrideScopePicker';
import { useActionsDisabled, useOverrides } from '../../state';
import { useArtifactConfiguration } from './hooks/useArtifactConfiguration/useArtifactConfiguration';
import { useSaveArtifactOverride } from './hooks/useSaveArtifactOverride/useSaveArtifactOverride';
import { OverridesSelectionForm } from './OverridesForm/OverridesSelectionForm';
import { ArtifactConfigurationActions } from './ArtifactConfigurationActions/ArtifactConfigurationActions';

export function ArtifactConfigurationPage() {
  const navigate = useNavigate();
  const configuration = useArtifactConfiguration();
  const { scope, setScope } = useOverrides();
  const actionsDisabled = useActionsDisabled();
  const [selection, setSelection] = useState(() =>
    initialOverrideSelection(configuration?.selectedArtifactVersion),
  );
  const { clearOverride, errorMessage, loading, save } =
    useSaveArtifactOverride({ configuration, selection });

  if (!configuration) return <Navigate to={ARTIFACTS_ROUTE} replace />;

  const disabled = actionsDisabled || loading;

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
          <Heading dataHook="artifact-configuration-title" size="medium">
            {configuration.productionArtifactVersion.name}
          </Heading>
        }
        actionsBar={
          <ArtifactConfigurationActions
            onSave={save}
            onCancel={close}
            onClear={clearOverride}
            saveDisabled={disabled}
            cancelDisabled={disabled}
            clearDisabled={disabled || !configuration.selectedArtifactVersion}
          />
        }
      />

      <Page.Content>
        <Box direction="vertical" gap="SP4">
          {errorMessage && (
            <Text
              dataHook="artifact-configuration-error"
              role="alert"
              skin="error"
            >
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
            configuration={configuration}
            onChange={setSelection}
          />
        </Box>
      </Page.Content>
    </Page>
  );
}
