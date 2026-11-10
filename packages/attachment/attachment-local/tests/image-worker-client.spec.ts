import { PassThrough } from 'node:stream'
import { ChildProcess } from 'node:child_process'
import { afterEach, expect, it, vi } from 'vitest'
import { ImageWorkerClient } from '../src/image-worker-client.ts'

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(), spawn: vi.fn(),
}))
import { spawn } from 'node:child_process'
const clients: ImageWorkerClient[] = []
afterEach(async () => { for (const client of clients.splice(0)) await client.dispose(); vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const child = Object.assign(new ChildProcess(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: vi.fn(() => { queueMicrotask(() => child.emit('close', null, 'SIGKILL')); return true }) })
  vi.mocked(spawn).mockReturnValue(child)
  const client = new ImageWorkerClient({ node: process.execPath, timeoutMs: 30_000 })
  clients.push(client)
  return { child, client }
}
it('waits for close before publishing JSON output and scrubs Electron startup variables', async () => {
  const { child, client } = fixture()
  const pending = client.run({ operation: 'read' })
  child.stdout.write(JSON.stringify({ ok: true, value: { bytes: 3 } }))
  child.emit('close', 0, null)
  await expect(pending).resolves.toEqual({ bytes: 3 })
  const options = vi.mocked(spawn).mock.calls[0]?.[2]
  expect(options?.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
  expect(options?.env).not.toHaveProperty('NODE_OPTIONS')
})
it('contains a signalled worker and permits subsequent requests', async () => {
  const { child, client } = fixture()
  const pending = client.run({})
  child.emit('close', null, 'SIGSEGV')
  await expect(pending).rejects.toThrow('signal=SIGSEGV')
  const retry = client.run({})
  child.stdout.write(JSON.stringify({ ok: true, value: 'recovered' }))
  child.emit('close', 0, null)
  await expect(retry).resolves.toBe('recovered')
})
it('preserves attachment error codes and rejects malformed worker replies', async () => {
  const { child, client } = fixture()
  const pending = client.run({})
  child.stdout.write(JSON.stringify({ ok: false, code: 'INVALID_IMAGE', message: 'Invalid image' }))
  child.emit('close', 0, null)
  await expect(pending).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
  const malformed = client.run({})
  child.stdout.write('{}'); child.emit('close', 0, null)
  await expect(malformed).rejects.toThrow('Invalid image worker reply')
})
it('kills timed-out children and settles after close', async () => {
  vi.useFakeTimers()
  const { child, client } = fixture()
  const pending = client.run({})
  const checked = expect(pending).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(30_000)
  await checked
  expect(child.kill).toHaveBeenCalledWith('SIGKILL')
})
it('cancels owned children on caller abort and plugin disposal', async () => {
  const { child, client } = fixture()
  const controller = new AbortController()
  const pending = client.run({}, controller.signal)
  const checked = expect(pending).rejects.toThrow('caller cancelled')
  controller.abort(new Error('caller cancelled')); await checked
  expect(child.kill).toHaveBeenCalled()
  const next = client.run({})
  const disposed = expect(next).rejects.toThrow('disposed')
  await client.dispose(); await disposed
  await expect(client.run({})).rejects.toThrow('disposed')
})
it('does not finish disposal before the child close event', async () => {
  const { child, client } = fixture()
  child.kill.mockImplementation(() => true)
  const pending = client.run({})
  const checked = expect(pending).rejects.toThrow('disposed')
  let settled = false
  const disposing = client.dispose().then(() => { settled = true })
  await Promise.resolve()
  expect(settled).toBe(false)
  child.emit('close', null, 'SIGKILL')
  await disposing
  await checked
  expect(settled).toBe(true)
})
it('fails invalid executable configuration before spawning', () => {
  expect(() => new ImageWorkerClient({ node: 'relative', timeoutMs: 1 })).toThrow('absolute Node path')
  expect(() => new ImageWorkerClient({ node: process.execPath, timeoutMs: 0 })).toThrow('positive timeoutMs')
})
