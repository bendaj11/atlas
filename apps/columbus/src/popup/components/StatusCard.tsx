import React from "react";
import { Badge, Box, Button, Card, Loader, Text } from "@wix/design-system";
import type { StatusState } from "../types.js";
import { refreshIcon } from "../wds-icons.js";

interface StatusCardProps {
  hostId: string | undefined;
  status: StatusState;
  onRefresh: () => void;
}

export function StatusCard({ hostId, status, onRefresh }: StatusCardProps): JSX.Element {
  const hasError = status.tone === "error";

  return (
    <Card className="status-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px" minWidth="0">
          {status.busy ? <Loader size="tiny" /> : <Badge skin={hasError ? "danger" : "success"}>{hasError ? "Issue" : "Ready"}</Badge>}
          <Box direction="vertical" flex="1" minWidth="0">
            <Text size="small" weight="bold" ellipsis>{hostId ?? "No host"}</Text>
            <Text size="tiny" skin={hasError ? "error" : "standard"} ellipsis>{status.message}</Text>
          </Box>
          <Button size="small" priority="secondary" disabled={status.busy} onClick={onRefresh} prefixIcon={refreshIcon} aria-label="Refresh host data">
            Refresh
          </Button>
        </Box>
      </Card.Content>
    </Card>
  );
}
