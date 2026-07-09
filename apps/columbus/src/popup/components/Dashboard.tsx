import React from "react";
import { Box } from "@wix/design-system";
import type { AppViewModel } from "../types.js";
import { AppOverrideRow } from "./AppOverrideRow.js";

interface DashboardProps {
  apps: AppViewModel[];
  busy: boolean;
  hasHost: boolean;
  onEdit: (appId: string) => void;
  onToggle: (appId: string) => void;
}

export function Dashboard({ apps, busy, hasHost, onEdit, onToggle }: DashboardProps): JSX.Element | null {
  if (!hasHost) return null;

  return (
    <Box direction="vertical" gap="12px">
      {apps.map((app) => (
        <AppOverrideRow
          key={app.production.id}
          app={app}
          busy={busy}
          onEdit={() => onEdit(app.production.id)}
          onToggle={() => onToggle(app.production.id)}
        />
      ))}
    </Box>
  );
}
