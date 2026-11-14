import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const run = vi.fn()
const dispose = vi.fn()
vi.mock('../src/image-worker-client.ts', () => ({
  ImageWorkerClient: class {
    run = run
    dispose = dispose
  },
}))

const { LocalAttachmentStore } = await import('../src/index.ts')

const DATA = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
function stored(refBytes: number) {
  return {
    ref: { attachmentId: 'sha256:' + 'a'.repeat(64), mediaType: 'image/png', bytes: refBytes, width: 2, height: 3 },
    data: Buffer.from(DATA).toString('base64'),
  }
}

const roots: string[] = []
async function home() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-attachment-worker-'))
  roots.push(root)
  return root
}

beforeEach(() => {
  run.mockReset()
  dispose.mockReset()
  run.mockResolvedValue(stored(DATA.byteLength))
})

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

it('rejects a worker pair without an executable', () => {
  expect(() => new LocalAttachmentStore(new Context(), { imageWorker: { timeoutMs: 30_000 } }))
    .toThrow(/both node and timeoutMs/)
})

it('validates through the worker when one is configured', async () => {
  const store = new LocalAttachmentStore(new Context(), {
    dshHome: await home(),
    imageWorker: { node: '/usr/bin/node', timeoutMs: 30_000 },
  })
  await store.validateImage({ data: DATA, mediaType: 'image/png', name: 'a.png' })
  expect(run).toHaveBeenCalledTimes(1)
  const request = run.mock.calls[0][0]
  expect(request).toMatchObject({ operation: 'prepare', input: { mediaType: 'image/png', name: 'a.png' } })
  expect(request.input.data).toBe(Buffer.from(DATA).toString('base64'))
})

it('reads through the worker when one is configured', async () => {
  const store = new LocalAttachmentStore(new Context(), {
    dshHome: await home(),
    imageWorker: { node: '/usr/bin/node', timeoutMs: 30_000 },
  })
  const stored = await store.readImage({ attachmentId: 'sha256:' + 'b'.repeat(64), mediaType: 'image/png', bytes: DATA.byteLength, width: 1, height: 1 })
  expect(run).toHaveBeenCalledWith(expect.objectContaining({ operation: 'read' }), undefined)
  expect(Buffer.from(stored.data)).toEqual(Buffer.from(DATA))
})

it('projects a request image through the worker', async () => {
  const ref = { attachmentId: 'sha256:' + 'c'.repeat(64), mediaType: 'image/png', bytes: DATA.byteLength, width: 1, height: 1 }
  run.mockResolvedValue({
    variantId: 'sha256:' + 'd'.repeat(64),
    attachment: ref,
    data: Buffer.from(DATA).toString('base64'),
    mediaType: 'image/png',
    width: 1,
    height: 1,
    depth: 'uchar',
    space: 'srgb',
    hasAlpha: false,
    bytes: DATA.byteLength,
  })
  const store = new LocalAttachmentStore(new Context(), {
    dshHome: await home(),
    imageWorker: { node: '/usr/bin/node', timeoutMs: 30_000 },
  })
  const projected = await store.readImageRequest(ref, {})
  expect(run).toHaveBeenCalledWith(expect.objectContaining({ operation: 'request' }), expect.anything())
  expect(projected.bytes).toBe(DATA.byteLength)
})

it('disposes the worker with the owning context', async () => {
  const ctx = new Context()
  new LocalAttachmentStore(ctx, {
    dshHome: await home(),
    imageWorker: { node: '/usr/bin/node', timeoutMs: 30_000 },
  })
  await ctx.fiber.dispose()
  expect(dispose).toHaveBeenCalledTimes(1)
})
