import React, { useEffect, useState } from "react";
import { Box, Button, Card, Divider, Input, RadioGroup, Text } from "@wix/design-system";
import { createEditorDraft, selectedManifest } from "../manifest-utils.js";
import type { EditorDraft, EditorModel, SaveOverrideValue, Scope } from "../types.js";
import { arrowLeftIcon } from "../wds-icons.js";
import { versionKey } from "../../manifest-versions.js";
import { EditorOption } from "./EditorOption.js";
import { EmptyFrame } from "./EmptyFrame.js";
import { ScopePicker } from "./ScopePicker.js";
import { VersionDropdown } from "./VersionDropdown.js";

interface EditorProps {
  model: EditorModel | undefined;
  busy: boolean;
  scope: Scope;
  onCancel: () => void;
  onError: (message: string) => void;
  onSave: (value: SaveOverrideValue) => void;
  onScopeChange: (scope: Scope) => void;
}

export function Editor({ model, busy, scope, onCancel, onError, onSave, onScopeChange }: EditorProps): JSX.Element {
  const [draft, setDraft] = useState<EditorDraft>(() => createEditorDraft(model?.production, model?.selected, model?.productionOptions ?? [], model?.prOptions ?? []));

  useEffect(() => {
    setDraft(createEditorDraft(model?.production, model?.selected, model?.productionOptions ?? [], model?.prOptions ?? []));
  }, [model]);

  if (!model) return <EmptyFrame title="App missing" message="Refresh host data and try again." />;

  const selectType = (type: EditorDraft["type"]): void => setDraft((current) => ({ ...current, type }));

  const save = (): void => {
    try {
      const selected = selectedManifest({ ...model, draft });
      if (selected?.channel === "local" && !model.allowCustomOverrides) {
        throw new Error("This host does not allow localhost or custom-URL overrides.");
      }
      onSave({ production: model.production, selected });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Card className="editor-card">
      <Card.Header
        title={model.production.name}
        subtitle="Choose source"
        suffix={<Button size="small" priority="secondary" onClick={onCancel} prefixIcon={arrowLeftIcon}>Back</Button>}
      />
      <Card.Content>
        <Box direction="vertical" gap="18px">
          <RadioGroup
            name="override-source"
            value={draft.type}
            onChange={(type) => selectType(type as EditorDraft["type"])}
            spacing="12px"
            selectionArea="always"
          >
            <RadioGroup.Radio
              value="custom"
              disabled={!model.allowCustomOverrides}
              content={(
                <EditorOption>
                  <Text size="small" weight="bold">Base URL</Text>
                  <Input
                    id="custom-url"
                    ariaLabel="Base URL"
                    value={draft.customUrl}
                    disabled={draft.type !== "custom" || !model.allowCustomOverrides}
                    placeholder="http://localhost:4513"
                    onChange={(event) => setDraft({ ...draft, customUrl: event.target.value })}
                  />
                </EditorOption>
              )}
            >
              Custom URL
            </RadioGroup.Radio>
            <RadioGroup.Radio
              value="production"
              content={(
                <EditorOption>
                  <Text size="small" weight="bold">Production version</Text>
                  <VersionDropdown
                    id="production-version"
                    ariaLabel="Production version"
                    disabled={draft.type !== "production"}
                    selectedId={draft.productionKey}
                    versions={model.productionOptions}
                    hostId={model.hostId}
                    currentId={versionKey(model.production)}
                    onChange={(productionKey) => setDraft({ ...draft, productionKey })}
                  />
                </EditorOption>
              )}
            >
              Production
            </RadioGroup.Radio>
            <RadioGroup.Radio
              value="pr"
              content={(
                <EditorOption>
                  <Text size="small" weight="bold">PR version</Text>
                  <VersionDropdown
                    id="pr-version"
                    ariaLabel="PR version"
                    disabled={draft.type !== "pr"}
                    selectedId={draft.prKey}
                    versions={model.prOptions}
                    hostId={model.hostId}
                    onChange={(prKey) => setDraft({ ...draft, prKey })}
                  />
                </EditorOption>
              )}
            >
              PR
            </RadioGroup.Radio>
          </RadioGroup>
          <ScopePicker value={scope} disabled={busy} onChange={onScopeChange} />
          <Divider />
          <Box align="right" gap="8px">
            <Button priority="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button disabled={busy} onClick={save}>Save</Button>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}
