import type { AtlasMountedWidgetHandle } from '../../host.js';

export interface LastForwardedInputs<TInputs extends object> {
  current: TInputs | undefined;
}

/** Forwards inputs to the mounted widget unless they shallow-equal the last applied set. */
export function forwardChangedInputs<TInputs extends object>(
  mounted: AtlasMountedWidgetHandle<TInputs>,
  appliedInputs: LastForwardedInputs<TInputs>,
  inputs: TInputs,
): void {
  const previous = appliedInputs.current;

  if (previous !== undefined && shallowEqual(previous, inputs)) return;

  appliedInputs.current = inputs;
  mounted.setInputs?.(inputs);
}

export function shallowEqual(left: object, right: object): boolean {
  const leftKeys = Object.keys(left) as Array<keyof typeof left>;
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      Object.is(left[key], (right as Record<string, unknown>)[key]),
  );
}
