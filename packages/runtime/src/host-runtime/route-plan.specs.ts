import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement, aSlotPlacement } from '@atlas/testkit';
import {
  collectPlacementsForHost,
  createRoutePlacementPlan,
  filterRoutePlacements,
  filterSlotPlacements,
  findRoutePlacementForPathname,
} from './route-plan.js';

describe('collectPlacementsForHost', () => {
  it('should keep placements that target the host or every host when collected', () => {
    const hostId = faker.string.uuid();
    const own = aRoutePlacement({ hostId });
    const shared = aSlotPlacement({ hostId: '*' });
    const manifest = anAppManifest({
      placements: [own, shared, aRoutePlacement()],
    });

    expect(collectPlacementsForHost([manifest], hostId)).toEqual([
      { manifest, placement: own },
      { manifest, placement: shared },
    ]);
  });
});

describe('filterRoutePlacements', () => {
  it('should keep only route placements when filtered', () => {
    const manifest = anAppManifest();
    const route = aRoutePlacement();

    expect(
      filterRoutePlacements([
        { manifest, placement: route },
        { manifest, placement: aSlotPlacement() },
      ]),
    ).toEqual([{ manifest, placement: route }]);
  });
});

describe('filterSlotPlacements', () => {
  it('should keep only slot placements when filtered', () => {
    const manifest = anAppManifest();
    const slot = aSlotPlacement();

    expect(
      filterSlotPlacements([
        { manifest, placement: aRoutePlacement() },
        { manifest, placement: slot },
      ]),
    ).toEqual([{ manifest, placement: slot }]);
  });
});

describe('createRoutePlacementPlan', () => {
  it('should keep the first placement and report the rest as conflicts when two placements share a normalized path', () => {
    const first = {
      manifest: anAppManifest(),
      placement: aRoutePlacement({ route: { path: '/orders' } }),
    };
    const second = {
      manifest: anAppManifest(),
      placement: aRoutePlacement({ route: { path: '/orders/' } }),
    };

    expect(createRoutePlacementPlan([first, second])).toEqual({
      available: [first],
      conflicts: [second],
    });
  });
});

describe('findRoutePlacementForPathname', () => {
  it('should return the placement with the longest matching path when several routes match', () => {
    const short = {
      manifest: anAppManifest(),
      placement: aRoutePlacement({ route: { path: '/orders' } }),
    };
    const long = {
      manifest: anAppManifest(),
      placement: aRoutePlacement({ route: { path: '/orders/:id' } }),
    };

    expect(findRoutePlacementForPathname([short, long], '/orders/42')).toBe(
      long,
    );
  });

  it('should return undefined when no route matches', () => {
    const placement = {
      manifest: anAppManifest(),
      placement: aRoutePlacement({ route: { path: '/orders' } }),
    };

    expect(
      findRoutePlacementForPathname([placement], `/${faker.string.uuid()}`),
    ).toBeUndefined();
  });
});
