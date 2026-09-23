import { jest } from '@jest/globals';
import type { AtlasMountedWidgetHandle } from '../../host.js';
import type {
  SetWidgetInputs,
  UnmountWidget,
} from '../../core/sdk-types/index.js';
import {
  forwardChangedInputs,
  shallowEqual,
  type LastForwardedInputs,
} from './widget-inputs.js';

interface WidgetInputs {
  readonly count: number;
}

export class WidgetInputsDriver {
  private readonly setInputs = jest.fn<SetWidgetInputs<WidgetInputs>>();
  private readonly unmount = jest.fn<UnmountWidget>(async () => undefined);
  private mounted: AtlasMountedWidgetHandle<WidgetInputs> = {
    setInputs: this.setInputs,
    unmount: this.unmount,
  };
  private readonly appliedInputs: LastForwardedInputs<WidgetInputs> = {
    current: undefined,
  };
  private equal: boolean | undefined;

  readonly given = {
    appliedInputs: (inputs: WidgetInputs): this => {
      this.appliedInputs.current = inputs;

      return this;
    },
    widgetWithoutSetInputs: (): this => {
      this.mounted = { unmount: this.unmount };

      return this;
    },
  };

  readonly when = {
    inputsForwarded: (inputs: WidgetInputs): void => {
      forwardChangedInputs(this.mounted, this.appliedInputs, inputs);
    },
    objectsCompared: (left: object, right: object): void => {
      this.equal = shallowEqual(left, right);
    },
  };

  readonly get = {
    setInputsMock: (): jest.Mock<SetWidgetInputs<WidgetInputs>> =>
      this.setInputs,
    appliedInputs: (): WidgetInputs | undefined => this.appliedInputs.current,
    equal: (): boolean | undefined => this.equal,
  };
}
