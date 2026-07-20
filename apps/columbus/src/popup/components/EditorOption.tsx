import React from 'react';

interface EditorOptionProps {
  children: React.ReactNode;
}

export function EditorOption({ children }: EditorOptionProps) {
  return <div className="editor-option">{children}</div>;
}
