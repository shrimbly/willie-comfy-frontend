import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { emptyParams } from './paramNormalize'
import { deleteMoshpitDB, getAssetMeta, getThumb } from './thumbRepository'
import { createWorkerBridge } from './workerBridge'
import type { WorkerInMessage, WorkerOutMessage } from './workerMessages'

class FakeWorker implements Worker {
  public posted: WorkerInMessage[] = []
  public onmessage: ((ev: MessageEvent<WorkerOutMessage>) => void) | null = null
  public onerror: ((ev: ErrorEvent) => void) | null = null
  public onmessageerror: ((ev: MessageEvent) => void) | null = null

  postMessage(msg: WorkerInMessage): void {
    this.posted.push(msg)
  }

  terminate(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}

  dispatchEvent(): boolean {
    return true
  }

  emit(msg: WorkerOutMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: msg }))
  }
}

describe('workerBridge', () => {
  let fake: FakeWorker

  beforeEach(async () => {
    await deleteMoshpitDB()
    fake = new FakeWorker()
  })

  afterEach(async () => {
    await deleteMoshpitDB()
  })

  it('enqueue posts an enqueue message to the worker', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    bridge.enqueue({
      id: 'f1:a1',
      filterId: 'f1',
      fetchUrl: 'https://example.test/a.png',
      assetHash: 'H',
      assetId: 'a1'
    })
    // Flush the idle callback (falls back to setTimeout in test env)
    await new Promise((r) => setTimeout(r, 0))
    expect(fake.posted[0]?.type).toBe('enqueue')
    bridge.destroy()
  })

  it('routes thumbReady through IDB and fires onThumbReady', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    let received = 0
    bridge.onThumbReady(() => received++)

    fake.emit({
      type: 'thumbReady',
      id: 'f1:a1',
      filterId: 'f1',
      contentHash: 'H',
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'a1',
      params: emptyParams(Date.now())
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(received).toBe(1)
    const cached = await getThumb('H')
    expect(cached?.contentHash).toBe('H')
    bridge.destroy()
  })

  it('drops stale-filter thumbReady (no IDB write, no callback)', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f2')
    let received = 0
    bridge.onThumbReady(() => received++)

    fake.emit({
      type: 'thumbReady',
      id: 'f1:a1',
      filterId: 'f1',
      contentHash: 'STALE',
      blob: new Blob(['x']),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'a1',
      params: emptyParams(Date.now())
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(received).toBe(0)
    expect(await getThumb('STALE')).toBeUndefined()
    bridge.destroy()
  })

  it('cancelAll posts abortAll', () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    bridge.cancelAll()
    expect(fake.posted.some((m) => m.type === 'abortAll')).toBe(true)
    bridge.destroy()
  })

  it('putAssetMeta is called with params from msg.params (not emptyParams)', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')

    const workerParams = {
      ...emptyParams(1000),
      cfg: 7.5,
      steps: 30,
      model: 'v1-5.safetensors',
      workflowFilename: 'my_sweep'
    }

    fake.emit({
      type: 'thumbReady',
      id: 'f1:a1',
      filterId: 'f1',
      contentHash: 'PHASH',
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'a1',
      params: workerParams
    })

    await new Promise((r) => setTimeout(r, 20))
    const record = await getAssetMeta('PHASH')
    expect(record?.params).toEqual(workerParams)
    bridge.destroy()
  })
})
