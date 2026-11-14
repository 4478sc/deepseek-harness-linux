import { defineConfig } from 'tsdown'

export default defineConfig([
  { entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false },
  { entry: ['lib/types/image-worker.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false,
    deps: { alwaysBundle: [/^@deepseek-ai\//u] }, outputOptions: { codeSplitting: false } },
])
