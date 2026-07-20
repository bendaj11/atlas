import { useEffect, useState } from 'react';
import { Box, Button, Input, Page, RadioGroup, Text } from '@wix/design-system';
import { createEditorDraft, selectedManifest } from '../manifest-utils.js';
import type { EditorDraft } from '../types.js';
import { versionKey } from '../../manifest-versions.js';
import { EditorOption } from './EditorOption.js';
import { EmptyFrame } from './EmptyFrame.js';
import { ScopePicker } from './ScopePicker.js';
import { VersionDropdown } from './VersionDropdown.js';
import { usePopupHost } from '../../context/PopupHostContext';
import { usePopupNavigation } from '../../context/PopupNavigationContext';
import { usePopupOverrides } from '../../context/PopupOverridesContext';

export function ArtifactConfigurationPage() {
  const { status } = usePopupHost();
  const { artifactConfiguration: model, showArtifactsList } =
    usePopupNavigation();
  const {
    reportError,
    saveOverride,
    scope,
    setScope,
    status: overrideStatus,
  } = usePopupOverrides();
  const actionsDisabled = status === 'LOADING' || overrideStatus === 'APPLYING';
  const [draft, setDraft] = useState<EditorDraft>(() =>
    createEditorDraft(
      model?.production,
      model?.selected,
      model?.productionOptions ?? [],
      model?.prOptions ?? [],
    ),
  );

  useEffect(() => {
    setDraft(
      createEditorDraft(
        model?.production,
        model?.selected,
        model?.productionOptions ?? [],
        model?.prOptions ?? [],
      ),
    );
  }, [model]);

  if (!model)
    return (
      <EmptyFrame
        title="App missing"
        message="Refresh host data and try again."
      />
    );

  const selectType = (type: EditorDraft['type']): void =>
    setDraft((current) => ({ ...current, type }));

  const save = (): void => {
    try {
      const selected = selectedManifest({ ...model, draft });
      if (selected?.channel === 'local' && !model.allowCustomOverrides) {
        throw new Error(
          'This host does not allow localhost or custom-URL overrides.',
        );
      }
      saveOverride({ production: model.production, selected });
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Page>
      <Page.Header
        title={model.production.name}
        subtitle="Choose source"
        showBackButton
        backButtonAriaLabel="Back"
        onBackClicked={showArtifactsList}
        actionsBar={
          <Box gap="8px">
            <Button
              size="small"
              priority="secondary"
              skin="destructive"
              disabled={actionsDisabled || !model.selected}
              onClick={() =>
                saveOverride({
                  production: model.production,
                  selected: undefined,
                })
              }
            >
              Clear override
            </Button>
            <Button
              size="small"
              priority="secondary"
              disabled={actionsDisabled}
              onClick={showArtifactsList}
            >
              Cancel
            </Button>
            <Button
              size="small"
              priority="secondary"
              disabled={actionsDisabled}
              onClick={save}
            >
              Save
            </Button>
          </Box>
        }
      />
      <Page.Content>
        <Box direction="vertical" gap="18px">
          <RadioGroup
            name="override-source"
            value={draft.type}
            onChange={(type) => selectType(type as EditorDraft['type'])}
            spacing="12px"
            selectionArea="always"
          >
            <RadioGroup.Radio
              value="custom"
              disabled={!model.allowCustomOverrides}
            >
              <EditorOption>
                <Text size="small" weight="bold">
                  Custom URL
                </Text>
                <Input
                  id="custom-url"
                  ariaLabel="Base URL"
                  value={draft.customUrl}
                  disabled={
                    draft.type !== 'custom' || !model.allowCustomOverrides
                  }
                  placeholder="http://localhost:4513"
                  onChange={(event) =>
                    setDraft({ ...draft, customUrl: event.target.value })
                  }
                />
              </EditorOption>
            </RadioGroup.Radio>
            <RadioGroup.Radio value="production">
              <EditorOption>
                <Text size="small" weight="bold">
                  Production
                </Text>
                <VersionDropdown
                  id="production-version"
                  ariaLabel="Production version"
                  disabled={draft.type !== 'production'}
                  selectedId={draft.productionKey}
                  versions={model.productionOptions}
                  hostId={model.hostId}
                  currentId={versionKey(model.production)}
                  onChange={(productionKey) =>
                    setDraft({ ...draft, productionKey })
                  }
                />
              </EditorOption>
            </RadioGroup.Radio>
            <RadioGroup.Radio
              value="pr"
              disabled={model.prOptions.length === 0}
            >
              <EditorOption>
                <Text size="small" weight="bold">
                  PR
                </Text>
                <VersionDropdown
                  id="pr-version"
                  ariaLabel="PR version"
                  disabled={draft.type !== 'pr'}
                  selectedId={draft.prKey}
                  versions={model.prOptions}
                  hostId={model.hostId}
                  onChange={(prKey) => setDraft({ ...draft, prKey })}
                />
              </EditorOption>
            </RadioGroup.Radio>
          </RadioGroup>
          <ScopePicker
            value={scope}
            disabled={actionsDisabled}
            onChange={setScope}
          />
        </Box>
      </Page.Content>
    </Page>
  );
}
