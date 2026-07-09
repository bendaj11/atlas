import React from "react";
import { ArrowLeft, Edit, Refresh } from "@wix/wix-ui-icons-common";

export const arrowLeftIcon = iconElement(ArrowLeft);
export const editIcon = iconElement(Edit);
export const refreshIcon = iconElement(Refresh);

function iconElement(icon: unknown): React.ReactElement {
  return React.createElement(icon as React.ComponentType);
}
