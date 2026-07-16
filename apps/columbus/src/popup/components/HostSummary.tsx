import React from "react";
import { Badge, Box, Card, Text } from "@wix/design-system";
import type { AtlasHostData } from "../../contracts.js";
import { versionLabel } from "../manifest-utils.js";

interface HostSummaryProps {
  hostData: AtlasHostData;
}

export function HostSummary({ hostData }: HostSummaryProps): JSX.Element {
  const environment = hostEnvironment(hostData.pageUrl);

  return (
    <Card>
      <Card.Header
        title={hostData.config.hostId}
        subtitle="Atlas host"
        suffix={<Badge size="small" skin={environment === "Local" ? "warning" : "standard"}>{environment}</Badge>}
      />
      <Card.Content>
        <Box direction="vertical" gap="6px">
          <Box gap="6px">
            <Text size="small" weight="bold">Version</Text>
            <Text size="small">Server stable · client {versionLabel(hostData.catalog.host)}</Text>
          </Box>
          <Text size="tiny" secondary ellipsis>{hostData.pageUrl}</Text>
        </Box>
      </Card.Content>
    </Card>
  );
}

function hostEnvironment(pageUrl: string): "Local" | "Production" {
  const hostname = new URL(pageUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" ? "Local" : "Production";
}
