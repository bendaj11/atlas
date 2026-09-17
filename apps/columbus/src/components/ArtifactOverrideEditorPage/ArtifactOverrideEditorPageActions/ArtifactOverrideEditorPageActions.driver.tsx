import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import {
  ButtonTestkit,
  IconButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { ArtifactOverrideEditorPageActions } from './ArtifactOverrideEditorPageActions';

type ActionsProps = ComponentProps<typeof ArtifactOverrideEditorPageActions>;

export class ArtifactOverrideEditorPageActionsDriver {
  private readonly onSave = jest.fn<ActionsProps['onSave']>();
  private readonly onClear = jest.fn<ActionsProps['onClear']>();
  private readonly onCancel = jest.fn<ActionsProps['onCancel']>();
  private saveDisabled = false;
  private clearDisabled = false;
  private cancelDisabled = false;
  private baseElement!: Element;

  readonly given = {
    saveDisabled: (disabled: boolean) => {
      this.saveDisabled = disabled;

      return this;
    },
    clearDisabled: (disabled: boolean) => {
      this.clearDisabled = disabled;

      return this;
    },
    cancelDisabled: (disabled: boolean) => {
      this.cancelDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <ArtifactOverrideEditorPageActions
          onSave={this.onSave}
          onClear={this.onClear}
          onCancel={this.onCancel}
          saveDisabled={this.saveDisabled}
          clearDisabled={this.clearDisabled}
          cancelDisabled={this.cancelDisabled}
        />,
      ).baseElement;
    },
    saveClicked: () => this.get.button('save-overrideOptions').click(),
    clearClicked: () => this.get.iconButton().click(),
    cancelClicked: () => this.get.button('cancel-overrideOptions').click(),
  };

  readonly get = {
    button: (dataHook: string) =>
      ButtonTestkit({ wrapper: this.baseElement, dataHook }),
    iconButton: () =>
      IconButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'clear-override',
      }),
    saveMock: () => this.onSave,
    clearMock: () => this.onClear,
    cancelMock: () => this.onCancel,
  };
}
