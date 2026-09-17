import { createContext } from 'react';
import type { AtlasAppContext } from '../../lifecycle.js';
import type { AtlasSdk as AtlasSdkValue } from '../../host.js';

export const AtlasSdkContext = createContext<AtlasSdkValue | undefined>(
  undefined,
);

/** Changes identity on every host-data update so consumers re-render. */
export const AtlasHostDataContext = createContext<object | undefined>(
  undefined,
);

export const AtlasRuntimeContext = createContext<AtlasAppContext | undefined>(
  undefined,
);

export const AtlasStyleTargetContext = createContext<
  (Node & ParentNode) | undefined
>(undefined);
