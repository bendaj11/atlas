import React from "react";
import { Badge, Box, Button, Card, ToggleSwitch } from "@wix/design-system";
import { badgeSkin, overrideLabel } from "../manifest-utils.js";
import type { AppViewModel } from "../types.js";
import { editIcon } from "../wds-icons.js";

interface AppOverrideRowProps {
  app: AppViewModel;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

export function AppOverrideRow({ app, busy, onEdit, onToggle }: AppOverrideRowProps): JSX.Element {
  const toggleLabel = `${app.selected ? "Disable" : "Enable"} ${app.production.name} override`;

  return (
    <Card className="app-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px" minWidth="0">
          <Box direction="vertical" flex="1" minWidth="0">
            <span className="app-name">{app.production.name}</span>
            <span className="app-url">{app.currentUrl}</span>
          </Box>
          <Badge skin={badgeSkin(app.overrideType)}>{overrideLabel(app.overrideType)}</Badge>
          <Box className="app-actions" gap="8px" verticalAlign="middle">
            <ToggleSwitch
              size="small"
              checked={app.overrideEnabled}
              disabled={busy || !app.canToggle}
              onChange={onToggle}
              aria-label={toggleLabel}
            />
            <Button size="small" priority="secondary" disabled={busy} onClick={onEdit} prefixIcon={editIcon}>
              Edit
            </Button>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}
