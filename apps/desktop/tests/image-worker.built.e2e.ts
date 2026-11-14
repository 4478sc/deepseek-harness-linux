/** Native image processing must stay outside Electron's Linux process. */
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { finished } from 'node:stream/promises'
import type { WriteStream } from 'node:fs'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'

it.skipIf(process.platform !== 'linux' || process.env.DSH_EXAMPLE_MODE !== 'lib')(
  'saves, reads and projects images in the actual Electron Node runtime', { retry: 0 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-image-electron-'))
    try {
      const entry = join(root, 'probe.mjs')
      const packageRoot = fileURLToPath(new URL('../../../packages/attachment/attachment-local/', import.meta.url))
      const node = process.execPath
      const require = createRequire(import.meta.url)
      const builderRequire = createRequire(require.resolve('app-builder-lib/package.json'))
      const { createPackageWithOptions } = builderRequire('@electron/asar') as {
        createPackageWithOptions: (source: string, destination: string, options: object) => Promise<WriteStream>
      }
      const staged = join(root, 'staged')
      const archive = join(root, 'app.asar')
      const relativePackage = 'dsh/node_modules/@deepseek-ai/dsh-attachment-local'
      await mkdir(join(staged, relativePackage), { recursive: true })
      await cp(join(packageRoot, 'lib'), join(staged, relativePackage, 'lib'), { recursive: true })
      await cp(join(packageRoot, 'package.json'), join(staged, relativePackage, 'package.json'))
      await finished(await createPackageWithOptions(staged, archive, { unpack: '**/image-worker.js' }))
      const physicalModules = join(root, 'app.asar.unpacked/dsh/node_modules')
      await mkdir(physicalModules, { recursive: true })
      const codecRequire = createRequire(join(packageRoot, 'package.json'))
      await symlink(dirname(dirname(codecRequire.resolve('sharp'))), join(physicalModules, 'sharp'), 'dir')
      await writeFile(entry, `
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(${JSON.stringify(join(packageRoot, 'package.json'))});
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')));
const archiveUrl = ${JSON.stringify(pathToFileURL(archive).href)};
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(archiveUrl) && !specifier.startsWith('.') && !specifier.startsWith('node:'))
    return next(pathToFileURL(require.resolve(specifier)).href, context);
  return next(specifier, context);
} });
const { default: Store } = await import(${JSON.stringify(pathToFileURL(join(archive, relativePackage, 'lib/index.js')).href)});
const ctx = new Context();
try {
  await ctx.plugin(Store, { dshHome: ${JSON.stringify(root)}, imageWorker: { node: ${JSON.stringify(node)}, timeoutMs: 30000 } });
  const input = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const ref = await ctx.attachments.saveImage({ data: input, mediaType: 'image/png' });
  assert.equal((await ctx.attachments.readImage(ref)).ref.width, 1);
  assert.equal((await ctx.attachments.readImageRequest(ref, { width: 1, height: 1, maxBytes: 4096 })).width, 1);
  await assert.rejects(ctx.attachments.saveImage({ data: Buffer.from('broken'), mediaType: 'image/png' }), { code: 'INVALID_IMAGE' });
  assert.ok(!Object.keys(require.cache).some(path => /sharp.*[.]node$/.test(path)));
  process.stdout.write('IMAGE_WORKER_ELECTRON_OK');
} finally { await ctx.fiber.dispose(); }
`)
      const electron = process.env.DSH_TEST_ELECTRON ?? createRequire(import.meta.url)('electron') as string
      const result = await promisify(execFile)(electron, [entry], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 60_000, maxBuffer: 1024 * 1024,
      })
      expect(result.stdout).toBe('IMAGE_WORKER_ELECTRON_OK')
    } finally { await rm(root, { recursive: true, force: true }) }
  },
)
