import React, { useEffect } from "react";
import { Box, Button, WixDesignSystemProvider } from "@wix/design-system";
import { usePopupController } from "../usePopupController.js";
import { refreshIcon } from "../wds-icons.js";
import { Dashboard } from "./Dashboard.js";
import { Editor } from "./Editor.js";
import { EmptyFrame } from "./EmptyFrame.js";

export function PopupApp(): JSX.Element {
  const controller = usePopupController();

  useEffect(() => {
    void controller.load();
  }, [controller.load]);

  return (
    <WixDesignSystemProvider>
      <Box direction="vertical" backgroundColor="D80" width="560px" height="620px" overflowY="auto" borderRadius="12px">
        <Box padding="16px" direction="vertical" gap="14px">
          {!controller.hostData && controller.status.busy ? (
            <EmptyFrame title="Loading Atlas host" message={controller.status.message} />
          ) : null}
          {!controller.hostData && !controller.status.busy ? (
            <EmptyFrame
              title="No Atlas host"
              message={controller.status.message}
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
          ) : null}
          {controller.hostData ? <div role="status">{controller.status.message}</div> : null}
          {controller.view.name === "dashboard" ? (
            <Dashboard
              apps={controller.apps}
              widgetProviders={controller.widgetProviders}
              host={controller.host}
              busy={controller.status.busy}
              hostData={controller.hostData}
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
