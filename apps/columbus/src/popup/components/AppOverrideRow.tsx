import React from "react";
import { Badge, Box, Button, Card, Text, ToggleSwitch } from "@wix/design-system";
import { badgeSkin, overrideLabel } from "../manifest-utils.js";
import type { AppViewModel } from "../types.js";
import { editIcon } from "../wds-icons.js";

interface AppOverrideRowProps {
  app: AppViewModel;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  label?: string;
}

export function AppOverrideRow({ app, busy, onEdit, onToggle, label }: AppOverrideRowProps): JSX.Element {
  const toggleLabel = `${app.selected ? "Disable" : "Enable"} ${app.production.name} override`;

  return (
    <Card className="app-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px" minWidth="0">
          <ToggleSwitch
            size="small"
            checked={app.overrideEnabled}
            disabled={busy || !app.canToggle}
            onChange={onToggle}
            aria-label={toggleLabel}
          />
          <Box direction="vertical" gap="3px" flex="1" minWidth="0">
            <Box gap="6px" verticalAlign="middle" minWidth="0">
              <Text size="medium" weight="bold">{app.production.name}</Text>
              <Badge size="tiny" skin={badgeSkin(app.overrideType)}>{overrideLabel(app.overrideType)}</Badge>
            </Box>
            <Text size="tiny" secondary ellipsis>{app.currentUrl}</Text>
            {label ? <Text size="tiny" secondary>{label}</Text> : null}
          </Box>
          <Box gap="8px" verticalAlign="middle" flex="0 0 auto">
            <Button size="small" priority="secondary" disabled={busy} onClick={onEdit} prefixIcon={editIcon}>
              Edit
            </Button>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}
