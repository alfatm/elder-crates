import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { builtinModules } from 'node:module'

// All Node.js built-in modules (with and without node: prefix)
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)]

export default defineConfig({
  build: {
    lib: {
      entry: {
        extension: resolve(__dirname, 'src/extension/index.ts'),
        cli: resolve(__dirname, 'src/cli/index.ts'),
      },
      formats: ['cjs'],
      fileName: (_, entryName) => `${entryName}.cjs`,
    },
    rollupOptions: {
      external: ['vscode', ...nodeBuiltins],
      output: {
        // Ensure each entry point gets its own complete bundle
        chunkFileNames: '[name].cjs',
      },
    },
    target: 'node16',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
  },
})
