import { resolve } from 'node:path';
import { createReactAppViteConfig } from '@atlas/sdk/federation-config';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(
  mergeConfig(
    createReactAppViteConfig({
      projectRoot: __dirname,
      projectName: 'catalog-react',
      reactMajor: 19,
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
      server: { port: 4201, cors: true },
    },
  ),
);
