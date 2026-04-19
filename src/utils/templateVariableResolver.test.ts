import { describe, expect, it, vi } from 'vitest'

import {
  getTemplateVariables,
  parseTemplateSegments,
  previewResolvedValue,
  resolveTemplateVariables
} from '@/utils/templateVariableResolver'

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    activeWorkflow: { filename: 'my-workflow' }
  }))
}))

vi.mock('@/composables/graph/useGraphHierarchy', () => ({
  useGraphHierarchy: vi.fn(() => ({
    findParentGroup: vi.fn(() => ({ title: 'Render Group' }))
  }))
}))

const mockCustomVariables = vi.hoisted(() => ({
  value: [] as { name: string; value: string }[]
}))

vi.mock('@/utils/formatUtil', () => ({
  formatDate: vi.fn((fmt: string) => {
    const map: Record<string, string> = {
      'yyyy-MM-dd': '2025-01-15',
      'yyyy-MM-dd-HH-mm-ss': '2025-01-15-14-30-00',
      yyyy: '2025',
      MM: '01',
      dd: '15',
      'HH-mm-ss': '14-30-00'
    }
    return map[fmt] ?? fmt
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: (key: string) => {
      if (key === 'Comfy.Filename.CustomVariables')
        return mockCustomVariables.value
      return undefined
    }
  }))
}))

function makeNode(title: string) {
  return { title } as Parameters<typeof resolveTemplateVariables>[1]
}

function makeGraph() {
  return {} as Parameters<typeof resolveTemplateVariables>[0]
}

describe('resolveTemplateVariables', () => {
  it('resolves @project', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/output'
    )
    expect(result).toBe('My-project/output')
  })

  it('resolves @workflowTitle', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@workflowTitle/output'
    )
    expect(result).toBe('my-workflow/output')
  })

  it('resolves @groupTitle', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@groupTitle/output'
    )
    expect(result).toBe('Render Group/output')
  })

  it('resolves @nodeTitle', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('MyNode'),
      '@nodeTitle/output'
    )
    expect(result).toBe('MyNode/output')
  })

  it('resolves multiple variables in one string', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/@workflowTitle/@nodeTitle'
    )
    expect(result).toBe('My-project/my-workflow/SaveImage')
  })

  it('passes through unknown @tokens unchanged', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@unknown/output'
    )
    expect(result).toBe('@unknown/output')
  })

  it('preserves existing %date% syntax alongside @ syntax', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/%date:yyyy%'
    )
    expect(result).toBe('My-project/%date:yyyy%')
  })

  it('sanitizes filesystem-invalid characters', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('Save:Image|Test'),
      '@nodeTitle'
    )
    expect(result).toBe('Save_Image_Test')
  })

  it('resolves custom variables', () => {
    mockCustomVariables.value = [{ name: 'client', value: 'acme' }]
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@client/output'
    )
    expect(result).toBe('acme/output')
    mockCustomVariables.value = []
  })

  it('resolves custom variables alongside built-in ones', () => {
    mockCustomVariables.value = [{ name: 'studio', value: 'pixar' }]
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/@studio/@nodeTitle'
    )
    expect(result).toBe('My-project/pixar/SaveImage')
    mockCustomVariables.value = []
  })

  it('sanitizes custom variable values', () => {
    mockCustomVariables.value = [{ name: 'tag', value: 'a:b|c' }]
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@tag'
    )
    expect(result).toBe('a_b_c')
    mockCustomVariables.value = []
  })

  it('resolves @DateYYYYMMDD', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@DateYYYYMMDD/output'
    )
    expect(result).toBe('2025-01-15/output')
  })

  it('resolves @DateYYYYMMDDHHmmss', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@DateYYYYMMDDHHmmss'
    )
    expect(result).toBe('2025-01-15-14-30-00')
  })

  it('resolves @DateYYYY', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@DateYYYY'
    )
    expect(result).toBe('2025')
  })

  it('resolves date variables alongside other variables', () => {
    const result = resolveTemplateVariables(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/@DateYYYYMMDD/@nodeTitle'
    )
    expect(result).toBe('My-project/2025-01-15/SaveImage')
  })
})

describe('parseTemplateSegments', () => {
  it('parses text with no variables', () => {
    expect(parseTemplateSegments('plain text')).toEqual([
      { type: 'text', value: 'plain text' }
    ])
  })

  it('parses a single variable', () => {
    expect(parseTemplateSegments('@project')).toEqual([
      { type: 'variable', name: 'project' }
    ])
  })

  it('parses mixed text and variables', () => {
    expect(parseTemplateSegments('output/@project/@nodeTitle-img')).toEqual([
      { type: 'text', value: 'output/' },
      { type: 'variable', name: 'project' },
      { type: 'text', value: '/' },
      { type: 'variable', name: 'nodeTitle' },
      { type: 'text', value: '-img' }
    ])
  })

  it('treats unknown @tokens as plain text', () => {
    expect(parseTemplateSegments('@unknown')).toEqual([
      { type: 'text', value: '@unknown' }
    ])
  })

  it('returns empty array for empty string', () => {
    expect(parseTemplateSegments('')).toEqual([])
  })

  it('recognizes custom variables', () => {
    mockCustomVariables.value = [{ name: 'client', value: 'acme' }]
    expect(parseTemplateSegments('output/@client')).toEqual([
      { type: 'text', value: 'output/' },
      { type: 'variable', name: 'client' }
    ])
    mockCustomVariables.value = []
  })
})

describe('previewResolvedValue', () => {
  it('resolves variables without sanitization', () => {
    const result = previewResolvedValue(
      makeGraph(),
      makeNode('Save:Image'),
      '@nodeTitle'
    )
    expect(result).toBe('Save:Image')
  })

  it('resolves multiple variables', () => {
    const result = previewResolvedValue(
      makeGraph(),
      makeNode('SaveImage'),
      '@project/@workflowTitle'
    )
    expect(result).toBe('My-project/my-workflow')
  })

  it('resolves custom variables without sanitization', () => {
    mockCustomVariables.value = [{ name: 'tag', value: 'a:b' }]
    const result = previewResolvedValue(
      makeGraph(),
      makeNode('SaveImage'),
      '@tag'
    )
    expect(result).toBe('a:b')
    mockCustomVariables.value = []
  })
})

describe('getTemplateVariables', () => {
  it('returns built-in variables when no custom defined', () => {
    mockCustomVariables.value = []
    const vars = getTemplateVariables()
    expect(vars).toHaveLength(10)
    expect(vars.map((v) => v.name)).toEqual([
      'project',
      'workflowTitle',
      'groupTitle',
      'nodeTitle',
      'DateYYYYMMDD',
      'DateYYYYMMDDHHmmss',
      'DateYYYY',
      'DateMM',
      'DateDD',
      'DateHHmmss'
    ])
  })

  it('includes custom variables after built-in ones', () => {
    mockCustomVariables.value = [
      { name: 'client', value: 'acme' },
      { name: 'studio', value: 'pixar' }
    ]
    const vars = getTemplateVariables()
    expect(vars).toHaveLength(12)
    expect(vars[10].name).toBe('client')
    expect(vars[11].name).toBe('studio')
    mockCustomVariables.value = []
  })
})
