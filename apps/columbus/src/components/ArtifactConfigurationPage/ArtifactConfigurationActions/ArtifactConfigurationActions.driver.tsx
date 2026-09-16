import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import {
  ButtonTestkit,
  IconButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { ArtifactConfigurationActions } from './ArtifactConfigurationActions';

type ActionsProps = ComponentProps<typeof ArtifactConfigurationActions>;

export class ArtifactConfigurationActionsDriver {
  private readonly onSave = jest.fn<ActionsProps['onSave']>();
  private readonly onClear = jest.fn<ActionsProps['onClear']>();
  private readonly onCancel = jest.fn<ActionsProps['onCancel']>();
  private saveDisabled = false;
  private clearDisabled = false;
  private cancelDisabled = false;
  private baseElement!: Element;

  readonly given = {
    saveDisabled: (disabled: boolean): this => {
      this.saveDisabled = disabled;

      return this;
    },
    clearDisabled: (disabled: boolean): this => {
      this.clearDisabled = disabled;

      return this;
    },
    cancelDisabled: (disabled: boolean): this => {
      this.cancelDisabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      this.baseElement = render(
        <ArtifactConfigurationActions
          onSave={this.onSave}
          onClear={this.onClear}
          onCancel={this.onCancel}
          saveDisabled={this.saveDisabled}
          clearDisabled={this.clearDisabled}
          cancelDisabled={this.cancelDisabled}
        />,
      ).baseElement;
    },
    saveClicked: async (): Promise<void> => {
      await this.get.button('save-configuration').click();
    },
    clearClicked: async (): Promise<void> => {
      await this.get.iconButton().click();
    },
    cancelClicked: async (): Promise<void> => {
      await this.get.button('cancel-configuration').click();
    },
  };

  readonly get = {
    button: (dataHook: string) =>
      ButtonTestkit({ wrapper: this.baseElement, dataHook }),
    iconButton: () =>
      IconButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'clear-override',
      }),
    saveMock: (): ActionsProps['onSave'] => this.onSave,
    clearMock: (): ActionsProps['onClear'] => this.onClear,
    cancelMock: (): ActionsProps['onCancel'] => this.onCancel,
  };
}
