import { expect, it } from 'vitest'
import { workerBytes, workerImage, workerProjection, workerRequest } from '../src/image-worker-protocol.ts'
const ref = { attachmentId: 'sha256:' + 'a'.repeat(64), mediaType: 'image/png', bytes: 3, width: 1, height: 1 }
it('decodes canonical base64 and validates byte counts', () => {
  expect(workerBytes('AQID')).toEqual(Uint8Array.of(1, 2, 3))
  expect(workerImage({ ref, data: 'AQID' })).toMatchObject({ ref })
  expect(() => workerBytes('AQI')).toThrow('Invalid image worker bytes')
  expect(() => workerImage({ ref, data: 'AQI=' })).toThrow('byte count mismatch')
})
it('rejects malformed references and projection fields from workers', () => {
  for (const patch of [{ attachmentId: '../unsafe' }, { width: 0 }, { bytes: -1 }, { mediaType: 'text/plain' }]) {
    expect(() => workerImage({ ref: { ...ref, ...patch }, data: 'AQID' })).toThrow()
  }
  expect(() => workerProjection({ data: 'AQID', bytes: 3, depth: 'ushort', space: 'srgb', hasAlpha: false })).toThrow()
})
it('rejects unsupported operations and malformed request fields', () => {
  expect(() => workerRequest({ operation: 'delete' })).toThrow('Unsupported')
  expect(() => workerRequest({ operation: 'read', root: 1, ref })).toThrow()
  expect(() => workerRequest({ operation: 'request',
    root: '/store',
    cacheRoot: '/cache',
    ref,
    target: { width: 0,
      height: 1,
      maxBytes: 1 } })).toThrow()
})
