/** Desktop-owned image isolation using the bundled standalone Node payload. */
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'

/**
 * Keep image isolation active across profile configuration reloads.
 * @param ctx - Application scope before config-tree activation.
 * @param primaryRuntime - Bundled primary runtime directory.
 * @param platform - Host platform; only Linux requires native codec isolation.
 */
export function configureImageWorker(ctx: Context, primaryRuntime: string, platform: NodeJS.Platform): void {
  if (platform !== 'linux') return
  ctx.on('internal/config', (fiber, next) => {
    const config: unknown = next()
    if (fiber.entry?.options.name !== '@deepseek-ai/dsh-attachment-local') return config
    if (config !== undefined && (typeof config !== 'object' || config === null || Array.isArray(config))) {
      throw new Error('attachment-local: expected an object configuration')
    }
    const fields = config as Record<string, unknown> | undefined
    return { ...fields, imageWorker: fields?.imageWorker ?? {
      node: join(primaryRuntime, 'dependencies', 'node', 'bin', 'node'), timeoutMs: 30_000,
    } }
  }, { global: true })
}
