import React, { useEffect } from "react";
import { Box, Button, WixDesignSystemProvider } from "@wix/design-system";
import { usePopupController } from "../usePopupController.js";
import { refreshIcon } from "../wds-icons.js";
import { Dashboard } from "./Dashboard.js";
import { Editor } from "./Editor.js";
import { EmptyFrame } from "./EmptyFrame.js";
import { StatusCard } from "./StatusCard.js";

export function PopupApp(): JSX.Element {
  const controller = usePopupController();

  useEffect(() => {
    void controller.load();
  }, [controller.load]);

  return (
    <WixDesignSystemProvider>
      <Box className="popup-shell" direction="vertical" backgroundColor="D80" minHeight="100vh">
        <Box padding="16px" direction="vertical" gap="14px">
          {controller.hostData || controller.status.busy ? (
            <StatusCard hostId={controller.hostData?.config.hostId} status={controller.status} onRefresh={() => void controller.load()} />
          ) : (
            <EmptyFrame
              title="No Atlas host"
              message="Open an Atlas host tab, then refresh."
              action={(
                <Button
                  size="small"
                  priority="secondary"
                  disabled={controller.status.busy}
                  onClick={() => void controller.load()}
                  prefixIcon={refreshIcon}
                  aria-label="Refresh host data"
                >
                  Refresh
                </Button>
              )}
            />
          )}
          {controller.view.name === "dashboard" ? (
            <Dashboard
              apps={controller.apps}
              busy={controller.status.busy}
              hasHost={Boolean(controller.hostData)}
              onEdit={controller.showEditor}
              onToggle={(appId) => void controller.toggleOverride(appId)}
            />
          ) : (
            <Editor
              model={controller.editor}
              busy={controller.status.busy}
              scope={controller.scope}
              onCancel={controller.showDashboard}
              onError={controller.setError}
              onSave={controller.saveOverride}
              onScopeChange={controller.setScope}
            />
          )}
        </Box>
      </Box>
    </WixDesignSystemProvider>
  );
}
