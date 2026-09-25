import {
  dismissedDevelopmentOffersKey,
  parseDismissedDevelopmentOffers,
  type AtlasDevelopmentOfferIds,
} from '@atlas/schema';
import type { AtlasRuntimeError } from '../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../types/override-document';
import type { Scope } from '../../types/columbus-state';
import { isStoredOverrideDocument } from '../override-document/override-document';

export interface StoredOverrides {
  overrides: OverrideDocument | undefined;
  overrideScope: Scope | undefined;
}

export function readStoredOverrides(
  documentKey: string,
  hostId: string,
): StoredOverrides {
  const tabStored = sessionStorage.getItem(documentKey);
  const stored = tabStored ?? localStorage.getItem(documentKey);
  if (!stored) return { overrides: undefined, overrideScope: undefined };

  const overrideScope: Scope = tabStored ? 'tab' : 'all';
  try {
    const document: unknown = JSON.parse(stored);

    return {
      overrides:
        isStoredOverrideDocument(document) && document.hostId === hostId
          ? document
          : undefined,
      overrideScope,
    };
  } catch {
    return { overrides: undefined, overrideScope };
  }
}

export function readDismissedOfferIds(
  hostId: string,
): AtlasDevelopmentOfferIds {
  const key = dismissedDevelopmentOffersKey(hostId);

  return parseDismissedDevelopmentOffers(
    sessionStorage.getItem(key) ?? localStorage.getItem(key),
  );
}

export function readRuntimeErrors(): AtlasRuntimeError[] {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]'),
  ].map((element) => {
    const appId =
      element.getAttribute('data-atlas-app-id') ??
      element.getAttribute('data-atlas-app');
    const message = element.textContent?.trim() || 'Unknown app error';

    return { ...(appId ? { artifactId: appId } : {}), message };
  });
}

export function readVisibleAppIds(): string[] {
  return [
    ...new Set(
      [...document.querySelectorAll<HTMLElement>('[data-atlas-app-id]')]
        .map((element) => element.getAttribute('data-atlas-app-id'))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}
