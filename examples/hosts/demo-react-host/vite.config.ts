import { resolve } from 'node:path';
import { createReactHostViteConfig } from '@atlas/sdk/federation-config';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(
  mergeConfig(
    createReactHostViteConfig({
      projectRoot: __dirname,
      projectName: 'demo-react-host',
    }),
    {
      base: './',
      plugins: [
        react({
          babel: {
            plugins: [
              [
                'babel-plugin-react-compiler',
                { target: '19', panicThreshold: 'none' },
              ],
            ],
          },
        }),
      ],
      resolve: {
        alias: [
          {
            find: /^react(\/.*)?$/,
            replacement: `${resolve(__dirname, 'node_modules/react')}$1`,
          },
          {
            find: /^react-dom(\/.*)?$/,
            replacement: `${resolve(__dirname, 'node_modules/react-dom')}$1`,
          },
        ],
      },
      server: { port: 4200, cors: true },
    },
  ),
);
