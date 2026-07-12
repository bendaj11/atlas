import React from "react";
import { Box } from "@wix/design-system";
import type { AtlasHostData } from "../../contracts.js";
import type { AppViewModel } from "../types.js";
import { AppOverrideRow } from "./AppOverrideRow.js";
import { HostSummary } from "./HostSummary.js";

interface DashboardProps {
  apps: AppViewModel[];
  busy: boolean;
  hostData: AtlasHostData | undefined;
  onEdit: (appId: string) => void;
  onToggle: (appId: string) => void;
}

export function Dashboard({ apps, busy, hostData, onEdit, onToggle }: DashboardProps): JSX.Element | null {
  if (!hostData) return null;

  return (
    <Box direction="vertical" gap="12px">
      <HostSummary hostData={hostData} />
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
