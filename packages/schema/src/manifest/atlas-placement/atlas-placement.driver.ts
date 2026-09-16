import { placementTargetsHost } from './atlas-placement.js';

export class AtlasPlacementDriver {
  private result = false;

  when = {
    targetChecked: (input: {
      placementHostId: string;
      hostId: string;
    }): void => {
      this.result = placementTargetsHost(
        { hostId: input.placementHostId },
        input.hostId,
      );
    },
  };

  get = {
    result: (): boolean => this.result,
  };
}
