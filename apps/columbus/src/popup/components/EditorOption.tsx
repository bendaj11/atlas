import React from "react";

interface EditorOptionProps {
  children: React.ReactNode;
}

export function EditorOption({ children }: EditorOptionProps): JSX.Element {
  return <div className="editor-option">{children}</div>;
}
