import { describe, expect, it, vi } from 'vitest'

import type { NormalizedParams } from './paramNormalize'
import { emptyParams } from './paramNormalize'
import { deriveFilenameFromAssetInput, processAsset } from './thumbWorker'
import type { WorkerOutMessage } from './workerMessages'

function makeDefaultParams(): NormalizedParams {
  return {
    ...emptyParams(0),
    cfg: 7,
    steps: 20,
    sampler: 'euler'
  }
}

function makeCtx(
  overrides: {
    fetchOk?: boolean
    parseResult?: Record<string, string>
    hashResult?: string
    thumb?: { blob: Blob; width: number; height: number }
    normalizeResult?: NormalizedParams
    nowResult?: number
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
      hash: vi.fn(async () => overrides.hashResult ?? 'CLIENT_HASH'),
      normalize: vi.fn(() => overrides.normalizeResult ?? makeDefaultParams()),
      now: vi.fn(() => overrides.nowResult ?? 1234567890)
    }
  }
}

describe('processAsset', () => {
  const baseInput = {
    id: 'f1:a1',
    filterId: 'f1',
    fetchUrl: 'https://example.test/a.png',
    assetHash: 'CLOUD_HASH',
    assetId: 'a1'
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

  it('posted thumbReady includes params from ctx.normalize', async () => {
    const expectedParams = makeDefaultParams()
    const { posted, ctx } = makeCtx({ normalizeResult: expectedParams })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    if (posted[0].type === 'thumbReady') {
      expect(posted[0].params).toEqual(expectedParams)
    }
  })

  it('ctx.now() is called once and its result is passed to ctx.normalize', async () => {
    const { posted, ctx } = makeCtx({ nowResult: 9999999 })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(ctx.now).toHaveBeenCalledTimes(1)
    expect(ctx.normalize).toHaveBeenCalledWith(
      expect.any(Object),
      9999999,
      expect.anything()
    )
    expect(posted).toHaveLength(1)
  })

  it('ctx.normalize receives derived source filename from fetchUrl', async () => {
    const { ctx } = makeCtx()
    const inputWithFilename = {
      ...baseInput,
      fetchUrl: 'https://example.test/outputs/my_sweep_00042_.png'
    }
    await processAsset(inputWithFilename, new AbortController().signal, ctx)
    expect(ctx.normalize).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Number),
      'my_sweep_00042_.png'
    )
  })

  it('ctx.normalize is NOT called when metadata parse returns empty (excluded)', async () => {
    const { ctx } = makeCtx({ parseResult: {} })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(ctx.normalize).not.toHaveBeenCalled()
  })

  it('ctx.normalize is NOT called on fetch failure (excluded)', async () => {
    const { ctx } = makeCtx({ fetchOk: false })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(ctx.normalize).not.toHaveBeenCalled()
  })
})

describe('deriveFilenameFromAssetInput', () => {
  function makeInput(fetchUrl: string) {
    return {
      id: 'f1:a1',
      filterId: 'f1',
      fetchUrl,
      assetHash: 'H',
      assetId: 'a1'
    }
  }

  it('prefers ?filename= query param on ComfyUI view URLs', () => {
    const input = makeInput(
      '/api/view?filename=ComfyUI_00001_.png&subfolder=&type=output'
    )
    expect(deriveFilenameFromAssetInput(input)).toBe('ComfyUI_00001_.png')
  })

  it('prefers ?filename= over the path segment on absolute view URLs', () => {
    const input = makeInput(
      'http://127.0.0.1:8188/api/view?filename=my_run_00042_.png'
    )
    expect(deriveFilenameFromAssetInput(input)).toBe('my_run_00042_.png')
  })

  it('falls back to last path segment when no ?filename= is present', () => {
    const input = makeInput('https://example.test/outputs/my_sweep_00042_.png')
    expect(deriveFilenameFromAssetInput(input)).toBe('my_sweep_00042_.png')
  })

  it('falls back to last path segment on relative direct-file URLs', () => {
    const input = makeInput('/outputs/flow.png')
    expect(deriveFilenameFromAssetInput(input)).toBe('flow.png')
  })

  it('falls back to path segment when ?filename= is empty', () => {
    const input = makeInput('/api/view?filename=&subfolder=output')
    expect(deriveFilenameFromAssetInput(input)).toBe('view')
  })
})
