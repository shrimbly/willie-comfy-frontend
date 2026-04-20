import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMoshpitWorkflowOptions } from './useMoshpitWorkflowOptions'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'

// Stub useMoshpitAssetRegistry so we control `entries` in tests.
// The registry composes three stores that need full store setup — simpler to
// mock the composable boundary and test useMoshpitWorkflowOptions in isolation.
vi.mock('./useMoshpitAssetRegistry', () => ({
  useMoshpitAssetRegistry: vi.fn()
}))

import { useMoshpitAssetRegistry } from './useMoshpitAssetRegistry'
const mockRegistry = vi.mocked(useMoshpitAssetRegistry)

type RegistryEntry = {
  id: string
  contentHash: string
  thumbUrl: undefined
  hasMetadata: boolean
}

function makeEntry(contentHash: string): RegistryEntry {
  return { id: contentHash, contentHash, thumbUrl: undefined, hasMetadata: true }
}

// Build a raw metadata record that produces a known workflowFilename and fingerprint.
// source_filename is read by moshpitMetadataStore.paramsByHash to derive workflowFilename.
// prompt JSON is parsed for the workflowFingerprint (class_type set).
function makeMeta(classType: string, sourceFilename: string | null): Record<string, string> {
  const prompt = JSON.stringify({ n1: { class_type: classType, inputs: {} } })
  const meta: Record<string, string> = { prompt }
  if (sourceFilename !== null) meta['source_filename'] = sourceFilename
  return meta
}

describe('useMoshpitWorkflowOptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns empty options when registry has no entries', () => {
    const entries = ref<readonly RegistryEntry[]>([])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })
    const { options } = useMoshpitWorkflowOptions()
    expect(options.value).toHaveLength(0)
  })

  it('groups assets by workflowFingerprint with displayName from workflowFilename', () => {
    const metaStore = useMoshpitMetadataStore()
    // Three assets with fingerprint 'KSampler', using filename 'cfg_sweep'
    metaStore.setMetadata('hash-A1', makeMeta('KSampler', 'cfg_sweep_00001_.png'))
    metaStore.setMetadata('hash-A2', makeMeta('KSampler', 'cfg_sweep_00002_.png'))
    metaStore.setMetadata('hash-A3', makeMeta('KSampler', 'cfg_sweep_00003_.png'))
    // One asset with fingerprint 'CLIPTextEncode', filename 'portrait_v2'
    metaStore.setMetadata('hash-B1', makeMeta('CLIPTextEncode', 'portrait_v2_00001_.png'))

    const entries = ref<readonly RegistryEntry[]>([
      makeEntry('hash-A1'),
      makeEntry('hash-A2'),
      makeEntry('hash-A3'),
      makeEntry('hash-B1')
    ])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    const opts = options.value

    expect(opts).toHaveLength(2)
    const [first, second] = opts
    // KSampler group: count 3 and displayName from stripped filename
    expect(first.count).toBe(3)
    expect(first.displayName).toBe('cfg_sweep')
    // CLIPTextEncode group: count 1
    expect(second.count).toBe(1)
    expect(second.displayName).toBe('portrait_v2')
  })

  it('uses unnamed- fallback when workflowFilename is null', () => {
    const metaStore = useMoshpitMetadataStore()
    // No source_filename → workflowFilename === null
    metaStore.setMetadata('hash-X', makeMeta('VAEDecode', null))

    const entries = ref<readonly RegistryEntry[]>([makeEntry('hash-X')])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    const [opt] = options.value
    expect(opt.displayName).toMatch(/^unnamed-/)
    // Fingerprint 'VAEDecode' is 9 chars — no ellipsis, no truncation
    expect(opt.displayName).toBe('unnamed-VAEDecode')
  })

  it('prefers non-null workflowFilename over null within same fingerprint (mixed assets)', () => {
    const metaStore = useMoshpitMetadataStore()
    // Same class_type → same fingerprint; mix of filenames
    metaStore.setMetadata('hash-F1', makeMeta('KSampler', 'foo_00001_.png'))
    metaStore.setMetadata('hash-F2', makeMeta('KSampler', null))
    metaStore.setMetadata('hash-F3', makeMeta('KSampler', 'foo_00003_.png'))

    const entries = ref<readonly RegistryEntry[]>([
      makeEntry('hash-F1'),
      makeEntry('hash-F2'),
      makeEntry('hash-F3')
    ])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    expect(options.value).toHaveLength(1)
    // The non-null filename 'foo' should win over the null one
    expect(options.value[0].displayName).toBe('foo')
    expect(options.value[0].count).toBe(3)
  })

  it('excludes assets with empty workflowFingerprint', () => {
    const metaStore = useMoshpitMetadataStore()
    // No prompt key → empty fingerprint → excluded
    metaStore.setMetadata('hash-empty', {})

    const entries = ref<readonly RegistryEntry[]>([makeEntry('hash-empty')])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    expect(options.value).toHaveLength(0)
  })

  it('excludes assets without a paramsByHash entry', () => {
    // No metadata stored for this hash → paramsByHash.get returns undefined
    const entries = ref<readonly RegistryEntry[]>([makeEntry('hash-missing')])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    expect(options.value).toHaveLength(0)
  })

  it('truncates fingerprints longer than 12 chars in the unnamed- label', () => {
    const metaStore = useMoshpitMetadataStore()
    // Two class_types → fingerprint 'CLIPTextEncode|KSampler' (23 chars)
    const prompt = JSON.stringify({
      n1: { class_type: 'KSampler', inputs: {} },
      n2: { class_type: 'CLIPTextEncode', inputs: {} }
    })
    metaStore.setMetadata('hash-long', { prompt })

    const entries = ref<readonly RegistryEntry[]>([makeEntry('hash-long')])
    mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })

    const { options } = useMoshpitWorkflowOptions()
    const [opt] = options.value
    // Fingerprint 'CLIPTextEncode|KSampler' is > 12 chars → truncated with ellipsis
    expect(opt.displayName).toMatch(/^unnamed-.{1,13}\u2026$/)
  })
})
