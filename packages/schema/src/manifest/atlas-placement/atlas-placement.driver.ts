import { placementTargetsHost } from './atlas-placement.js';

export class AtlasPlacementDriver {
  private result = false;

  when = {
    targetChecked: (input: { placementHostId: string; hostId: string }) => {
      this.result = placementTargetsHost(
        { hostId: input.placementHostId },
        input.hostId,
      );
    },
  };

  get = {
    result: () => this.result,
  };
}
