/** One-shot image subprocesses; callers retain storage publication and concurrency ownership. */
import { spawn } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AttachmentError, isAttachmentError } from '@deepseek-ai/dsh-attachment'

/** Standalone Node executable and complete operation deadline. */
export interface ImageWorkerConfig {
  node: string
  timeoutMs: number
}

/** Validate and run image operations without loading native codecs in the host. */
export class ImageWorkerClient {
  private readonly running = new Map<AbortController, Promise<void>>()
  private disposed = false
  constructor(private readonly config: ImageWorkerConfig) {
    if (!isAbsolute(config.node) || !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1) {
      throw new Error('attachment-local: imageWorker requires an absolute Node path and positive timeoutMs')
    }
    accessSync(config.node, constants.X_OK)
  }

  /** Stop all owned children and reject future operations. */
  async dispose(): Promise<void> {
    this.disposed = true
    for (const controller of this.running.keys()) controller.abort(new Error('Image worker disposed'))
    await Promise.all(this.running.values())
  }

  /**
   * Run a JSON operation and wait for process exit before publishing its response.
   * @param request - Operation fields; binary input is encoded by the owning caller.
   * @param signal - Caller cancellation, propagated to the owned process.
   * @returns Decoded JSON response, validated by the owning caller.
   */
  async run(request: object, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted()
    if (this.disposed) throw new Error('Image worker disposed')
    const controller = new AbortController()
    const closed = Promise.withResolvers<void>()
    this.running.set(controller, closed.promise)
    const abort = (): void => { controller.abort(signal?.reason) }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const excluded = new Set(['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH'])
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !excluded.has(key)))
        const entry = fileURLToPath(new URL('./image-worker.js', import.meta.url)).replace(/([\/])app\.asar([\/])/u, '$1app.asar.unpacked$2')
        const child = spawn(this.config.node, [entry], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
        const chunks: Buffer[] = []
        let bytes = 0
        let failure: Error | undefined
        const fail = (error: Error): void => { failure ??= error; child.kill('SIGKILL') }
        const cancel = (): void => { fail(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Image worker cancelled')) }
        controller.signal.addEventListener('abort', cancel, { once: true })
        const timer = setTimeout(() => { fail(new Error('Image worker timed out')) }, this.config.timeoutMs)
        child.stdout.on('data', (chunk: Buffer) => {
          bytes += chunk.byteLength
          if (bytes > 64 * 1024 * 1024) fail(new Error('Image worker response exceeds 64 MiB'))
          else chunks.push(chunk)
        })
        child.stderr.resume()
        child.on('error', (error) => { failure ??= error })
        child.stdin.on('error', (error) => { failure ??= error })
        child.once('close', (code, exitSignal) => {
          clearTimeout(timer)
          controller.signal.removeEventListener('abort', cancel)
          if (failure !== undefined) { reject(failure); return }
          if (code !== 0) { reject(new Error('Image worker exited (code=' + String(code) + ', signal=' + String(exitSignal) + ')')); return }
          try {
            const reply: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (typeof reply !== 'object' || reply === null || !('ok' in reply)) throw new Error('Invalid image worker reply')
            if (reply.ok === true && 'value' in reply) { resolve(reply.value); return }
            if ('message' in reply && typeof reply.message === 'string') {
              const error = Object.assign(new Error(reply.message), 'code' in reply ? { code: reply.code } : {})
              throw isAttachmentError(error) ? new AttachmentError(error.message, error.code) : error
            }
            throw new Error('Invalid image worker reply')
          } catch (error) { reject(error instanceof Error ? error : new Error('Invalid image worker reply')) }
        })
        try {
          const encoded = JSON.stringify(request)
          if (Buffer.byteLength(encoded) > 64 * 1024 * 1024) throw new Error('Image worker request exceeds 64 MiB')
          child.stdin.end(encoded)
        } catch (error) { fail(error instanceof Error ? error : new Error('Image worker request failed')) }
      })
    } finally {
      signal?.removeEventListener('abort', abort)
      this.running.delete(controller)
      closed.resolve()
    }
  }
}
