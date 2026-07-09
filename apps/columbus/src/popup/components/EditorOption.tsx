import React from "react";
import { Box } from "@wix/design-system";

interface EditorOptionProps {
  active: boolean;
  label: React.ReactNode;
  children: React.ReactNode;
}

export function EditorOption({ active, label, children }: EditorOptionProps): JSX.Element {
  return (
    <Box className="editor-option" direction="vertical" gap="8px" opacity={active ? 1 : 0.56}>
      <Box verticalAlign="middle" minHeight="24px">{label}</Box>
      {children}
    </Box>
  );
}
