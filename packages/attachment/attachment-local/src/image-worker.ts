/** Private standalone-Node entry: one request, no durable image publication, one JSON response. */
import { isAttachmentError } from '@deepseek-ai/dsh-attachment'
import { prepareImageFile, readImageFile } from './store.ts'
import { readRequestImageFile } from './request-image.ts'
import { workerBytes, workerRequest } from './image-worker-protocol.ts'

async function main(): Promise<void> {
  if (process.versions.electron !== undefined) throw new Error('Image worker requires standalone Node')
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of process.stdin) {
    if (!(chunk instanceof Uint8Array)) throw new Error('Invalid image worker input chunk')
    const data = Buffer.from(chunk)
    bytes += data.byteLength
    if (bytes > 64 * 1024 * 1024) throw new Error('Image worker request exceeds 64 MiB')
    chunks.push(data)
  }
  const request = workerRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  const result = request.operation === 'prepare'
    ? await prepareImageFile({ ...request.input, data: workerBytes(request.input.data) }, request.limits, request.policy)
    : request.operation === 'read'
      ? await readImageFile(request.root, request.ref)
      : await readRequestImageFile(request.cacheRoot, await readImageFile(request.root, request.ref), request.target)
  process.stdout.write(JSON.stringify({ ok: true, value: { ...result, data: Buffer.from(result.data).toString('base64') } }))
}
void main().catch((error: unknown) => {
  process.stdout.write(JSON.stringify({ ok: false,
    message: error instanceof Error ? error.message : 'Image worker failed',
    ...(isAttachmentError(error) ? { code: error.code } : {}) }))
})
