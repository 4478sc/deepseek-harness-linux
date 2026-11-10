/** JSON encoding for one-shot image workers; binary data never uses V8 serialization. */
import { isAbsolute } from 'node:path'
import { AttachmentId, ImageVariantId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
  ImageAttachmentLimits,
  SaveImageAttachment } from '@deepseek-ai/dsh-attachment'
import type { NormalizationPolicy } from './normalization.ts'

/** Operations owned by the local image backend. */
export type ImageWorkerRequest =
  | {
    operation: 'prepare'
    input: Omit<SaveImageAttachment, 'data'> & { data: string }
    limits: ImageAttachmentLimits
    policy: NormalizationPolicy
  }
  | { operation: 'read'; root: string; ref: ImageAttachmentRef }
  | { operation: 'request'; root: string; cacheRoot: string; ref: ImageAttachmentRef; target: ImageRequestTarget }

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid image worker object')
  return value as Record<string, unknown>
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Invalid image worker integer')
  return value
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid image worker string')
  return value
}
function absolutePath(value: unknown): string {
  const path = text(value)
  if (!isAbsolute(path)) throw new Error('Invalid image worker path')
  return path
}
function media(value: unknown): ImageAttachmentRef['mediaType'] {
  if (value !== 'image/png' && value !== 'image/jpeg' && value !== 'image/webp' && value !== 'image/gif') throw new Error('Invalid image worker media type')
  return value
}
function id(value: unknown): string {
  const result = text(value)
  if (!/^sha256:[a-f0-9]{64}$/u.test(result)) throw new Error('Invalid image worker identifier')
  return result
}
/** Decode and validate binary output before it reaches attachment storage.
 * @param value - JSON base64 string.
 * @returns Complete encoded image bytes.
 */
export function workerBytes(value: unknown): Uint8Array {
  const encoded = text(value)
  if (encoded.length > 64 * 1024 * 1024) throw new Error('Invalid image worker bytes')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) throw new Error('Invalid image worker bytes')
  return new Uint8Array(bytes)
}
/** Validate an attachment reference returned across the process pipe.
 * @param value - Parsed JSON reference.
 * @returns Validated branded reference.
 */
export function workerRef(value: unknown): ImageAttachmentRef {
  const row = record(value)
  const ref: ImageAttachmentRef = { attachmentId: AttachmentId(id(row.attachmentId)),
    mediaType: media(row.mediaType),
    bytes: integer(row.bytes),
    width: integer(row.width),
    height: integer(row.height) }
  if (row.name !== undefined) ref.name = text(row.name)
  if (row.originalDimensions !== undefined) {
    const dimensions = record(row.originalDimensions)
    ref.originalDimensions = { width: integer(dimensions.width), height: integer(dimensions.height) }
  }
  return ref
}
/** Decode a prepared or stored image response.
 * @param value - Parsed JSON result.
 * @returns Verified result fields and complete bytes.
 */
export function workerImage(value: unknown): { ref: ImageAttachmentRef; data: Uint8Array } {
  const row = record(value)
  const ref = workerRef(row.ref)
  const data = workerBytes(row.data)
  if (data.byteLength !== ref.bytes) throw new Error('Image worker byte count mismatch')
  return { ref, data }
}
/** Decode a projected request image response.
 * @param value - Parsed JSON result.
 * @returns Validated projection and complete bytes.
 */
export function workerProjection(value: unknown): RequestImageAttachment {
  const row = record(value)
  const data = workerBytes(row.data)
  if (row.depth !== 'uchar' || row.space !== 'srgb' || typeof row.hasAlpha !== 'boolean' || integer(row.bytes) !== data.byteLength) throw new Error('Invalid image worker projection')
  return { variantId: ImageVariantId(id(row.variantId)),
    attachment: workerRef(row.attachment),
    data,
    mediaType: media(row.mediaType),
    bytes: data.byteLength,
    width: integer(row.width),
    height: integer(row.height),
    depth: row.depth,
    space: row.space,
    hasAlpha: row.hasAlpha }
}
/** Validate a worker request before any decoding or filesystem access.
 * @param value - JSON request from the parent process.
 * @returns One supported operation with validated fields.
 */
export function workerRequest(value: unknown): ImageWorkerRequest {
  const row = record(value)
  if (row.operation === 'read') return { operation: 'read', root: absolutePath(row.root), ref: workerRef(row.ref) }
  if (row.operation === 'request') {
    const target = record(row.target)
    return { operation: 'request',
      root: absolutePath(row.root),
      cacheRoot: absolutePath(row.cacheRoot),
      ref: workerRef(row.ref),
      target: { width: integer(target.width),
        height: integer(target.height),
        maxBytes: integer(target.maxBytes) } }
  }
  if (row.operation !== 'prepare') throw new Error('Unsupported image worker operation')
  const input = record(row.input), limits = record(row.limits), policy = record(row.policy)
  if (!Array.isArray(limits.mediaTypes)) throw new Error('Invalid image worker media types')
  return { operation: 'prepare',
    input: { data: text(input.data),
      mediaType: media(input.mediaType),
      ...(input.name === undefined ? {} : { name: text(input.name) }) },
    limits: { maxImageBytes: integer(limits.maxImageBytes),
      maxImagesPerMessage: integer(limits.maxImagesPerMessage),
      maxMessageImageBytes: integer(limits.maxMessageImageBytes),
      maxImagePixels: integer(limits.maxImagePixels),
      maxImageDimension: integer(limits.maxImageDimension),
      mediaTypes: limits.mediaTypes.map(media) },
    policy: { maxPixels: integer(policy.maxPixels), maxDimension: integer(policy.maxDimension), maxBytes: integer(policy.maxBytes) } }
}
