import 'es-module-shims';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { defineReactHost } from '@atlas/runtime/react';
import atlasConfig from '../atlas.config';
import { HostLayout } from './host-layout';
import './styles.css';

export const mount = defineReactHost({
  config: atlasConfig,
  layout: HostLayout,
  reactDom: { createRoot },
  providers: StrictMode,
  useSdkOptions: () => ({}),
});
