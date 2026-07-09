import React, { useEffect, useState } from "react";
import { Box, Button, Card, Divider, Input, RadioGroup } from "@wix/design-system";
import { createEditorDraft, selectedManifest } from "../manifest-utils.js";
import type { EditorDraft, EditorModel, SaveOverrideValue, Scope } from "../types.js";
import { arrowLeftIcon } from "../wds-icons.js";
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

  const save = (): void => {
    try {
      onSave({ production: model.production, selected: selectedManifest({ ...model, draft }) });
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
          <RadioGroup value={draft.type} onChange={(type) => setDraft({ ...draft, type: type as EditorDraft["type"] })} spacing="12px">
            <EditorOption active={draft.type === "custom"} label={<RadioGroup.Radio value="custom">Base URL</RadioGroup.Radio>}>
              <Input
                id="custom-url"
                ariaLabel="Base URL"
                value={draft.customUrl}
                disabled={draft.type !== "custom"}
                placeholder="http://localhost:4513"
                onChange={(event) => setDraft({ ...draft, customUrl: event.target.value })}
              />
            </EditorOption>
            <EditorOption active={draft.type === "production"} label={<RadioGroup.Radio value="production">Production</RadioGroup.Radio>}>
              <VersionDropdown
                id="production-version"
                ariaLabel="Production"
                disabled={draft.type !== "production"}
                selectedId={draft.productionKey}
                versions={model.productionOptions}
                hostId={model.hostId}
                onChange={(productionKey) => setDraft({ ...draft, productionKey })}
              />
            </EditorOption>
            <EditorOption active={draft.type === "pr"} label={<RadioGroup.Radio value="pr">PR</RadioGroup.Radio>}>
              <VersionDropdown
                id="pr-version"
                ariaLabel="PR"
                disabled={draft.type !== "pr"}
                selectedId={draft.prKey}
                versions={model.prOptions}
                hostId={model.hostId}
                onChange={(prKey) => setDraft({ ...draft, prKey })}
              />
            </EditorOption>
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
