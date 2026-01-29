import { defineConfig } from 'tsup';
import { cpSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  },
  onSuccess: async () => {
    // Copy templates into the package so they ship with npm
    cpSync(
      resolve('..', '..', 'templates', '.ai'),
      resolve('templates', '.ai'),
      { recursive: true }
    );
  },
});
