import { describe, expect, it, vi } from 'vitest'

import { processAsset } from './thumbWorker'
import type { WorkerOutMessage } from './workerMessages'

function makeCtx(
  overrides: {
    fetchOk?: boolean
    parseResult?: Record<string, string>
    hashResult?: string
    thumb?: { blob: Blob; width: number; height: number }
  } = {}
) {
  const posted: WorkerOutMessage[] = []
  return {
    posted,
    ctx: {
      fetchFn: vi.fn(async () => ({
        ok: overrides.fetchOk !== false,
        status: overrides.fetchOk === false ? 500 : 200,
        arrayBuffer: async () => new ArrayBuffer(8)
      })) as unknown as typeof fetch,
      postMessage: (msg: WorkerOutMessage) => posted.push(msg),
      encodeThumb: vi.fn(
        async () =>
          overrides.thumb ?? {
            blob: new Blob(['webp'], { type: 'image/webp' }),
            width: 512,
            height: 512
          }
      ),
      parseMetadata: vi.fn(
        async () => overrides.parseResult ?? { workflow: '{}' }
      ),
      hash: vi.fn(async () => overrides.hashResult ?? 'CLIENT_HASH')
    }
  }
}

describe('processAsset', () => {
  const baseInput = {
    id: 'f1:a1',
    filterId: 'f1',
    fetchUrl: 'https://example.test/a.png',
    assetHash: 'CLOUD_HASH'
  }

  it('posts thumbReady with cloud asset_hash on happy path', async () => {
    const { posted, ctx } = makeCtx()
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('thumbReady')
    if (posted[0].type === 'thumbReady') {
      expect(posted[0].contentHash).toBe('CLOUD_HASH')
      expect(posted[0].width).toBe(512)
      expect(posted[0].metadata).toEqual({ workflow: '{}' })
    }
    expect(ctx.hash).not.toHaveBeenCalled()
  })

  it('falls back to client-side hash when assetHash is null', async () => {
    const { posted, ctx } = makeCtx()
    await processAsset(
      { ...baseInput, assetHash: null },
      new AbortController().signal,
      ctx
    )
    expect(posted[0].type).toBe('thumbReady')
    if (posted[0].type === 'thumbReady') {
      expect(posted[0].contentHash).toBe('CLIENT_HASH')
    }
    expect(ctx.hash).toHaveBeenCalledTimes(1)
  })

  it('posts excluded with reason no-metadata when parse returns {}', async () => {
    const { posted, ctx } = makeCtx({ parseResult: {} })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('excluded')
    if (posted[0].type === 'excluded')
      expect(posted[0].reason).toBe('no-metadata')
    expect(ctx.encodeThumb).not.toHaveBeenCalled()
  })

  it('posts excluded with reason fetch-failed on HTTP error', async () => {
    const { posted, ctx } = makeCtx({ fetchOk: false })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('excluded')
    if (posted[0].type === 'excluded')
      expect(posted[0].reason).toBe('fetch-failed')
  })

  it('posts nothing and returns silently when signal is already aborted', async () => {
    const { posted, ctx } = makeCtx()
    const ac = new AbortController()
    ac.abort()
    await processAsset(baseInput, ac.signal, ctx)
    expect(posted).toHaveLength(0)
  })
})
