import { expect, it } from 'vitest'
import { join } from 'node:path'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import { configureImageWorker } from '../src/image-worker.ts'

function fixture(platform: NodeJS.Platform = 'linux') {
  const ctx = new Context()
  configureImageWorker(ctx, '/relocated application/runtime/primary-runtime', platform)
  const fiber = { entry: { options: { name: '@deepseek-ai/dsh-attachment-local' } } } as Fiber
  const resolve = (config: object): unknown => ctx.waterfall(fiber, 'internal/config', config, () => config)
  return { ctx, fiber, resolve }
}
it('selects bundled standalone Node and preserves limits across repeated configuration', () => {
  const { resolve } = fixture()
  for (const maxImageBytes of [12345, 67890]) expect(resolve({ maxImageBytes })).toEqual({ maxImageBytes,
    imageWorker: { node: join('/relocated application/runtime/primary-runtime', 'dependencies/node/bin/node'), timeoutMs: 30_000 } })
})
it('preserves an explicitly configured worker executable and deadline', () => {
  const { resolve } = fixture()
  const config = { imageWorker: { node: '/custom/node', timeoutMs: 60_000 } }
  expect(resolve(config)).toEqual(config)
})
it.each(['darwin', 'win32'] as const)('leaves %s image execution unchanged', (platform) => {
  const { resolve } = fixture(platform)
  expect(resolve({ maxImageBytes: 123 })).toEqual({ maxImageBytes: 123 })
})
it('does not affect other attachment providers', () => {
  const { resolve, fiber } = fixture()
  fiber.entry!.options.name = 'another-provider'
  expect(resolve({ maxImageBytes: 123 })).toEqual({ maxImageBytes: 123 })
})
it('removes configuration defaults when its owning scope is disposed', async () => {
  const { ctx, resolve } = fixture()
  await ctx.fiber.dispose()
  expect(resolve({ maxImageBytes: 123 })).toEqual({ maxImageBytes: 123 })
})
