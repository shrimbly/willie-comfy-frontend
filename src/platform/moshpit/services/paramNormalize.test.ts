import { describe, expect, it } from 'vitest'

import {
  NormalizedParamsSchema,
  emptyParams,
  extractWorkflowFilename,
  normalizeParams
} from './paramNormalize'

describe('normalizeParams', () => {
  const NOW = 1700000000000

  // Minimal prompt fixtures
  const samplerPrompt = {
    '3': {
      class_type: 'KSampler',
      inputs: {
        cfg: 7.5,
        steps: 20,
        sampler_name: 'euler',
        scheduler: 'normal',
        seed: 42,
        positive: ['6', 0],
        negative: ['7', 0]
      }
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'sd_xl.safetensors' }
    },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: 'masterpiece' } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
    '8': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 1024, height: 768 }
    }
  }

  const samplerMeta = { prompt: JSON.stringify(samplerPrompt) }

  describe('missing/malformed input', () => {
    it('returns emptyParams for empty metadata', () => {
      const result = normalizeParams({}, NOW)
      const empty = emptyParams(NOW)
      expect(result).toEqual(empty)
      expect(result.model).toBeUndefined()
      expect(result.loras).toEqual([])
      expect(result.cfg).toBeUndefined()
      expect(result.steps).toBeUndefined()
      expect(result.sampler).toBeUndefined()
      expect(result.scheduler).toBeUndefined()
      expect(result.seed).toBeUndefined()
      expect(result.positivePrompt).toBeUndefined()
      expect(result.negativePrompt).toBeUndefined()
      expect(result.width).toBeUndefined()
      expect(result.height).toBeUndefined()
      expect(result.timestamp).toBe(NOW)
      expect(result.workflowFingerprint).toBe('')
      expect(result.workflowFilename).toBeNull()
    })

    it('returns emptyParams when prompt key is not valid JSON', () => {
      const result = normalizeParams({ prompt: 'not json' }, NOW)
      const empty = emptyParams(NOW)
      expect(result).toEqual(empty)
    })

    it('workflowFilename defaults to null when no sourceFilename provided', () => {
      const result = normalizeParams({}, NOW)
      expect(result.workflowFilename).toBeNull()
    })
  })

  describe('KSampler extraction', () => {
    it('extracts cfg, steps, sampler, scheduler, seed from KSampler node', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.cfg).toBe(7.5)
      expect(result.steps).toBe(20)
      expect(result.sampler).toBe('euler')
      expect(result.scheduler).toBe('normal')
      expect(result.seed).toBe(42)
    })

    it('returns undefined fields when no KSampler node is present', () => {
      const noSamplerPrompt = {
        '4': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'sd_xl.safetensors' }
        }
      }
      const result = normalizeParams(
        { prompt: JSON.stringify(noSamplerPrompt) },
        NOW
      )
      expect(result.cfg).toBeUndefined()
      expect(result.steps).toBeUndefined()
      expect(result.sampler).toBeUndefined()
      expect(result.scheduler).toBeUndefined()
      expect(result.seed).toBeUndefined()
      expect(result.positivePrompt).toBeUndefined()
      expect(result.negativePrompt).toBeUndefined()
    })
  })

  describe('Checkpoint extraction', () => {
    it('extracts model ckpt_name from CheckpointLoaderSimple node', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.model).toBe('sd_xl.safetensors')
    })
  })

  describe('LoRA extraction', () => {
    it('extracts loras array from LoraLoader nodes', () => {
      const loraPrompt = {
        '1': {
          class_type: 'LoraLoader',
          inputs: { lora_name: 'lora_a.safetensors', strength_model: 0.8 }
        },
        '2': {
          class_type: 'LoraLoader',
          inputs: { lora_name: 'lora_b.safetensors', strength_model: 0.5 }
        }
      }
      const result = normalizeParams(
        { prompt: JSON.stringify(loraPrompt) },
        NOW
      )
      expect(result.loras).toHaveLength(2)
      expect(result.loras[0]).toEqual({
        name: 'lora_a.safetensors',
        weight: 0.8
      })
      expect(result.loras[1]).toEqual({
        name: 'lora_b.safetensors',
        weight: 0.5
      })
    })

    it('defaults weight to 1 when strength_model is undefined', () => {
      const loraPrompt = {
        '1': {
          class_type: 'LoraLoader',
          inputs: { lora_name: 'lora_a.safetensors' }
        }
      }
      const result = normalizeParams(
        { prompt: JSON.stringify(loraPrompt) },
        NOW
      )
      expect(result.loras).toHaveLength(1)
      expect(result.loras[0]).toEqual({ name: 'lora_a.safetensors', weight: 1 })
    })
  })

  describe('Latent dimensions', () => {
    it('extracts width and height from EmptyLatentImage node', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.width).toBe(1024)
      expect(result.height).toBe(768)
    })
  })

  describe('Prompt resolution', () => {
    it('resolves positivePrompt from CLIPTextEncode node referenced by KSampler.positive', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.positivePrompt).toBe('masterpiece')
    })

    it('resolves negativePrompt from CLIPTextEncode node referenced by KSampler.negative', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.negativePrompt).toBe('ugly')
    })

    it('returns undefined positivePrompt when KSampler.positive is a plain string (not a ref array)', () => {
      const plainPositivePrompt = {
        '3': {
          class_type: 'KSampler',
          inputs: {
            cfg: 7,
            steps: 20,
            sampler_name: 'euler',
            scheduler: 'normal',
            seed: 1,
            positive: 'literal text',
            negative: ['7', 0]
          }
        },
        '7': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } }
      }
      const result = normalizeParams(
        { prompt: JSON.stringify(plainPositivePrompt) },
        NOW
      )
      expect(result.positivePrompt).toBeUndefined()
    })
  })

  describe('workflowFingerprint', () => {
    it('is a sorted unique pipe-joined list of class_types', () => {
      const graphWithDuplicates = {
        a: { class_type: 'KSampler', inputs: {} },
        b: { class_type: 'CheckpointLoaderSimple', inputs: {} },
        c: { class_type: 'KSampler', inputs: {} }
      }
      const result = normalizeParams(
        { prompt: JSON.stringify(graphWithDuplicates) },
        NOW
      )
      expect(result.workflowFingerprint).toBe(
        'CheckpointLoaderSimple|KSampler'
      )
    })

    it('produces identical fingerprint for same class_type set regardless of node IDs or order', () => {
      const graph1 = {
        nodeA: { class_type: 'KSampler', inputs: {} },
        nodeB: { class_type: 'CLIPTextEncode', inputs: {} }
      }
      const graph2 = {
        nodeZ: { class_type: 'CLIPTextEncode', inputs: {} },
        nodeY: { class_type: 'KSampler', inputs: {} }
      }
      const result1 = normalizeParams(
        { prompt: JSON.stringify(graph1) },
        NOW
      )
      const result2 = normalizeParams(
        { prompt: JSON.stringify(graph2) },
        NOW
      )
      expect(result1.workflowFingerprint).toBe(result2.workflowFingerprint)
    })

    it('returns empty string when prompt is empty', () => {
      const result = normalizeParams({}, NOW)
      expect(result.workflowFingerprint).toBe('')
    })
  })

  describe('workflowFilename (from sourceFilename argument)', () => {
    it('returns null when sourceFilename is null', () => {
      const result = normalizeParams(samplerMeta, NOW, null)
      expect(result.workflowFilename).toBeNull()
    })

    it('returns null when sourceFilename is undefined', () => {
      const result = normalizeParams(samplerMeta, NOW, undefined)
      expect(result.workflowFilename).toBeNull()
    })

    it('strips ComfyUI _NNNNN_ counter suffix + .png extension', () => {
      const result = normalizeParams(
        samplerMeta,
        NOW,
        'my_cfg_sweep_00042_.png'
      )
      expect(result.workflowFilename).toBe('my_cfg_sweep')
    })

    it('keeps plain stem when no counter present', () => {
      const result = normalizeParams(samplerMeta, NOW, 'flow.png')
      expect(result.workflowFilename).toBe('flow')
    })

    it('strips path prefix and counter', () => {
      const result = normalizeParams(
        samplerMeta,
        NOW,
        'some/subdir/flow_000123.png'
      )
      expect(result.workflowFilename).toBe('flow')
    })
  })

  describe('timestamp', () => {
    it('timestamp always equals the createdAtMs argument', () => {
      const result = normalizeParams(samplerMeta, NOW)
      expect(result.timestamp).toBe(NOW)
    })

    it('timestamp equals createdAtMs even when prompt is malformed', () => {
      const result = normalizeParams({ prompt: 'bad json' }, NOW)
      expect(result.timestamp).toBe(NOW)
    })
  })

  describe('Zod schema', () => {
    it('NormalizedParamsSchema.safeParse accepts a valid NormalizedParams object', () => {
      const result = normalizeParams(samplerMeta, NOW)
      const parsed = NormalizedParamsSchema.safeParse(result)
      expect(parsed.success).toBe(true)
    })

    it('NormalizedParamsSchema.safeParse rejects when timestamp is not a number', () => {
      const parsed = NormalizedParamsSchema.safeParse({
        model: undefined,
        loras: [],
        cfg: undefined,
        steps: undefined,
        sampler: undefined,
        scheduler: undefined,
        seed: undefined,
        positivePrompt: undefined,
        negativePrompt: undefined,
        width: undefined,
        height: undefined,
        timestamp: 'not-a-number',
        workflowFingerprint: '',
        workflowFilename: null
      })
      expect(parsed.success).toBe(false)
    })
  })
})

describe('saveNodeIdentity (D-08)', () => {
  const NOW = 1700000000000

  function buildGraphMeta(graph: Record<string, unknown>): {
    prompt: string
  } {
    return { prompt: JSON.stringify(graph) }
  }

  it('uses node._meta.title when a SaveImage output node has one', () => {
    const graph = {
      '10': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'out' },
        _meta: { title: 'Final Output' }
      }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBe('Final Output')
  })

  it('falls back to class_type when SaveImage has no _meta.title', () => {
    const graph = {
      '10': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'out' }
      }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBe('SaveImage')
  })

  it('uses _meta.title for PreviewImage output nodes', () => {
    const graph = {
      '11': {
        class_type: 'PreviewImage',
        inputs: {},
        _meta: { title: 'Debug Preview' }
      }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBe('Debug Preview')
  })

  it('returns null when there are no output-class nodes in the graph', () => {
    const graph = {
      '1': { class_type: 'KSampler', inputs: {} },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: 'hi' } }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBeNull()
  })

  it('returns the first output node in Object.values order when multiple are present', () => {
    const graph = {
      a: {
        class_type: 'SaveImage',
        inputs: {},
        _meta: { title: 'First' }
      },
      b: {
        class_type: 'SaveImage',
        inputs: {},
        _meta: { title: 'Second' }
      }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBe('First')
  })

  it('returns null when prompt graph is missing / malformed', () => {
    const missing = normalizeParams({}, NOW)
    expect(missing.saveNodeIdentity).toBeNull()

    const malformed = normalizeParams({ prompt: 'not json' }, NOW)
    expect(malformed.saveNodeIdentity).toBeNull()
  })

  it('emptyParams(createdAtMs) includes saveNodeIdentity: null', () => {
    const empty = emptyParams(NOW)
    expect(empty.saveNodeIdentity).toBeNull()
  })

  it('recognises the full set of output-class types', () => {
    const outputTypes = [
      'SaveImage',
      'PreviewImage',
      'SaveImageWebsocket',
      'SaveAnimatedWEBP',
      'SaveImageExtended'
    ]
    for (const classType of outputTypes) {
      const graph = {
        '9': {
          class_type: classType,
          inputs: {},
          _meta: { title: `title-for-${classType}` }
        }
      }
      const result = normalizeParams(buildGraphMeta(graph), NOW)
      expect(result.saveNodeIdentity).toBe(`title-for-${classType}`)
    }
  })

  it('falls back to class_type when _meta.title is an empty string', () => {
    const graph = {
      '10': {
        class_type: 'SaveImage',
        inputs: {},
        _meta: { title: '' }
      }
    }
    const result = normalizeParams(buildGraphMeta(graph), NOW)
    expect(result.saveNodeIdentity).toBe('SaveImage')
  })
})

describe('extractWorkflowFilename', () => {
  it('strips _NNNNN_ counter + extension', () => {
    expect(extractWorkflowFilename('my_workflow_00042_.png')).toBe(
      'my_workflow'
    )
  })

  it('returns null when stem is empty after strip', () => {
    expect(extractWorkflowFilename('_00042_.png')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractWorkflowFilename('')).toBeNull()
  })

  it('strips non-png extensions', () => {
    expect(extractWorkflowFilename('foo.jpg')).toBe('foo')
    expect(extractWorkflowFilename('foo.webp')).toBe('foo')
  })

  it('strips 4-digit counter', () => {
    expect(extractWorkflowFilename('foo_1234.png')).toBe('foo')
  })

  it('keeps digits without underscore separator', () => {
    expect(extractWorkflowFilename('foo123.png')).toBe('foo123')
  })

  it('returns null for null input', () => {
    expect(extractWorkflowFilename(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractWorkflowFilename(undefined)).toBeNull()
  })
})
