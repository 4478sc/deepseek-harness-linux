import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { LocalAttachmentStore } from '../src/index.ts'

it('resolves a profile that omits the image worker', () => {
  expect(LocalAttachmentStore.Config({})).toBeDefined()
})

it('leaves in-process decoding active when the worker object is empty', () => {
  expect(() => new LocalAttachmentStore(new Context(), { imageWorker: {} })).not.toThrow()
})

it('rejects a half-set worker pair', () => {
  expect(() => new LocalAttachmentStore(new Context(), { imageWorker: { node: process.execPath } }))
    .toThrow(/both node and timeoutMs/)
})
