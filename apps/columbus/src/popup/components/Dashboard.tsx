import React from "react";
import { Box, Text } from "@wix/design-system";
import type { AtlasHostData } from "../../contracts.js";
import { artifactKey } from "../../contracts.js";
import type { AppViewModel } from "../types.js";
import { AppOverrideRow } from "./AppOverrideRow.js";
import { HostSummary } from "./HostSummary.js";

interface DashboardProps {
  apps: AppViewModel[];
  widgetProviders: AppViewModel[];
  host: AppViewModel | undefined;
  busy: boolean;
  hostData: AtlasHostData | undefined;
  onEdit: (appId: string) => void;
  onToggle: (appId: string) => void;
}

export function Dashboard({ apps, widgetProviders, host, busy, hostData, onEdit, onToggle }: DashboardProps): JSX.Element | null {
  if (!hostData) return null;

  return (
    <Box direction="vertical" gap="12px">
      <HostSummary hostData={hostData} />
      {host ? (
        <Box direction="vertical" gap="4px">
          <Text size="tiny" secondary>High trust: selected host code controls routing, SDK, authentication integration, layout, and every app.</Text>
          <AppOverrideRow
            app={host}
            busy={busy}
            label="Host client · high trust"
            onEdit={() => onEdit(artifactKey(host.production))}
            onToggle={() => onToggle(artifactKey(host.production))}
          />
        </Box>
      ) : null}
      {apps.map((app) => (
        <AppOverrideRow
          key={app.production.id}
          app={app}
          busy={busy}
          onEdit={() => onEdit(artifactKey(app.production))}
          onToggle={() => onToggle(artifactKey(app.production))}
        />
      ))}
      {widgetProviders.map((app) => (
        <AppOverrideRow
          key={app.production.id}
          app={app}
          busy={busy}
          label="External widget provider · not mounted as app"
          onEdit={() => onEdit(artifactKey(app.production))}
          onToggle={() => onToggle(artifactKey(app.production))}
        />
      ))}
    </Box>
  );
}
