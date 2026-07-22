import { Box, Heading, Page, Text } from '@wix/design-system';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker/BrowserOverrideScopePicker';
import { useArtifactConfiguration } from './useArtifactConfiguration/useArtifactConfiguration';
import { OverridesSelectionForm } from './OverridesForm/OverridesSelectionForm';
import { ArtifactConfigurationActions } from './ArtifactConfigurationActions/ArtifactConfigurationActions';

export function ArtifactConfigurationPage() {
  const {
    scope,
    draft,
    configuration,
    actionsDisabled,
    close,
    save,
    setScope,
    updateDraft,
    clearOverride,
  } = useArtifactConfiguration();

  if (!configuration) return 'Error';

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
          <Heading size="medium">
            {configuration.productionManifest.name}
          </Heading>
        }
        actionsBar={
          <ArtifactConfigurationActions
            onSave={save}
            onCancel={close}
            onClear={clearOverride}
            saveDisabled={actionsDisabled}
            cancelDisabled={actionsDisabled}
            clearDisabled={actionsDisabled || !configuration.selectedManifest}
          />
        }
      />

      <Page.Content>
        <Box direction="vertical" gap="SP4">
          <BrowserOverrideScopePicker
            value={scope}
            onChange={setScope}
            disabled={actionsDisabled}
          />

          <OverridesSelectionForm
            draft={draft}
            configuration={configuration}
            onDraftChange={updateDraft}
          />
        </Box>
      </Page.Content>
    </Page>
  );
}
