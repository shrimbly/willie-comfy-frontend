import { describe, expect, it, vi } from 'vitest'

import {
  getTemplateVariables,
  isAbsolutePath,
  isVariableResolvable,
  parseTemplateSegments,
  previewResolvedValue,
  removeLeadingDirectoryToken,
  resolveDirectoryTokens,
  resolveTemplateVariables,
  setLeadingDirectoryToken,
  truncateDirectoryPath
} from '@/utils/templateVariableResolver'

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    activeWorkflow: { filename: 'my-workflow' }
  }))
}))

const mockParentGroup = vi.hoisted(() => ({
  value: { title: 'Render Group' } as { title: string } | null
}))

vi.mock('@/composables/graph/useGraphHierarchy', () => ({
  useGraphHierarchy: vi.fn(() => ({
    findParentGroup: vi.fn(() => mockParentGroup.value)
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
      { type: 'variable', name: 'project', prefix: '@' }
    ])
  })

  it('parses mixed text and variables', () => {
    expect(parseTemplateSegments('output/@project/@nodeTitle-img')).toEqual([
      { type: 'text', value: 'output/' },
      { type: 'variable', name: 'project', prefix: '@' },
      { type: 'text', value: '/' },
      { type: 'variable', name: 'nodeTitle', prefix: '@' },
      { type: 'text', value: '-img' }
    ])
  })

  it('flags unknown @tokens as missing variable segments', () => {
    expect(parseTemplateSegments('@unknown')).toEqual([
      { type: 'variable', name: 'unknown', prefix: '@', missing: true }
    ])
  })

  it('flags unknown @tokens alongside known ones', () => {
    expect(parseTemplateSegments('@project/@ghost/file')).toEqual([
      { type: 'variable', name: 'project', prefix: '@' },
      { type: 'text', value: '/' },
      { type: 'variable', name: 'ghost', prefix: '@', missing: true },
      { type: 'text', value: '/file' }
    ])
  })

  it('returns empty array for empty string', () => {
    expect(parseTemplateSegments('')).toEqual([])
  })

  it('recognizes custom variables', () => {
    mockCustomVariables.value = [{ name: 'client', value: 'acme' }]
    expect(parseTemplateSegments('output/@client')).toEqual([
      { type: 'text', value: 'output/' },
      { type: 'variable', name: 'client', prefix: '@' }
    ])
    mockCustomVariables.value = []
  })

  it('recognizes %width% and %height% runtime tokens', () => {
    expect(parseTemplateSegments('out-%width%x%height%')).toEqual([
      { type: 'text', value: 'out-' },
      { type: 'variable', name: 'width', prefix: '%' },
      { type: 'text', value: 'x' },
      { type: 'variable', name: 'height', prefix: '%' }
    ])
  })

  it('recognizes %batch_num% token', () => {
    expect(parseTemplateSegments('img_%batch_num%')).toEqual([
      { type: 'text', value: 'img_' },
      { type: 'variable', name: 'batch_num', prefix: '%' }
    ])
  })

  it('recognizes %date:...% tokens', () => {
    expect(parseTemplateSegments('%date:yyyy-MM-dd%/out')).toEqual([
      { type: 'variable', name: 'date:yyyy-MM-dd', prefix: '%' },
      { type: 'text', value: '/out' }
    ])
  })

  it('recognizes %Node.widget% references', () => {
    expect(parseTemplateSegments('%KSampler.seed%-%CLIP.text%')).toEqual([
      { type: 'variable', name: 'KSampler.seed', prefix: '%' },
      { type: 'text', value: '-' },
      { type: 'variable', name: 'CLIP.text', prefix: '%' }
    ])
  })

  it('leaves unknown %...% patterns as plain text', () => {
    expect(parseTemplateSegments('50% off')).toEqual([
      { type: 'text', value: '50% off' }
    ])
  })

  it('parses mixed @ and % tokens', () => {
    expect(parseTemplateSegments('@project/%width%x%height%')).toEqual([
      { type: 'variable', name: 'project', prefix: '@' },
      { type: 'text', value: '/' },
      { type: 'variable', name: 'width', prefix: '%' },
      { type: 'text', value: 'x' },
      { type: 'variable', name: 'height', prefix: '%' }
    ])
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

describe('parseTemplateSegments (directory token)', () => {
  it('parses %dir:<path>% as a directory segment with isAbsolute true', () => {
    expect(parseTemplateSegments('%dir:/Users/willie/photos%ComfyUI')).toEqual([
      { type: 'directory', path: '/Users/willie/photos', isAbsolute: true },
      { type: 'text', value: 'ComfyUI' }
    ])
  })

  it('marks relative paths as not absolute', () => {
    expect(parseTemplateSegments('%dir:subdir%ComfyUI')).toEqual([
      { type: 'directory', path: 'subdir', isAbsolute: false },
      { type: 'text', value: 'ComfyUI' }
    ])
  })

  it('recognizes Windows absolute paths', () => {
    const segs = parseTemplateSegments('%dir:C:\\Users\\me%file')
    expect(segs[0]).toEqual({
      type: 'directory',
      path: 'C:\\Users\\me',
      isAbsolute: true
    })
  })

  it('combines directory token with variables', () => {
    expect(parseTemplateSegments('%dir:/out%@project/@nodeTitle')).toEqual([
      { type: 'directory', path: '/out', isAbsolute: true },
      { type: 'variable', name: 'project', prefix: '@' },
      { type: 'text', value: '/' },
      { type: 'variable', name: 'nodeTitle', prefix: '@' }
    ])
  })
})

describe('resolveDirectoryTokens', () => {
  it('replaces %dir:<path>% with the path + separator', () => {
    expect(resolveDirectoryTokens('%dir:/a/b%foo')).toBe('/a/b/foo')
  })

  it('does not double trailing slashes', () => {
    expect(resolveDirectoryTokens('%dir:/a/b/%foo')).toBe('/a/b/foo')
  })

  it('absorbs a separator at the start of the following content', () => {
    expect(resolveDirectoryTokens('%dir:/a/b%/foo')).toBe('/a/b/foo')
  })

  it('leaves strings without the token untouched', () => {
    expect(resolveDirectoryTokens('@project/file')).toBe('@project/file')
  })

  it('normalizes Windows backslash trailing separator', () => {
    expect(resolveDirectoryTokens('%dir:C:\\out\\%file')).toBe('C:\\out/file')
  })
})

describe('isAbsolutePath', () => {
  it('accepts POSIX absolute paths', () => {
    expect(isAbsolutePath('/Users/willie')).toBe(true)
  })

  it('accepts home-relative paths', () => {
    expect(isAbsolutePath('~/pics')).toBe(true)
  })

  it('accepts Windows drive paths', () => {
    expect(isAbsolutePath('C:/temp')).toBe(true)
    expect(isAbsolutePath('D:\\work')).toBe(true)
  })

  it('accepts UNC paths', () => {
    expect(isAbsolutePath('\\\\server\\share')).toBe(true)
  })

  it('rejects relative paths', () => {
    expect(isAbsolutePath('output/sub')).toBe(false)
    expect(isAbsolutePath('sub')).toBe(false)
    expect(isAbsolutePath('')).toBe(false)
  })
})

describe('truncateDirectoryPath', () => {
  it('returns full path when shorter than maxLen', () => {
    expect(truncateDirectoryPath('/a/b')).toBe('/a/b')
  })

  it('returns last two segments with .../ prefix when too long', () => {
    expect(truncateDirectoryPath('/Users/willie/Documents/photos/output')).toBe(
      '.../photos/output'
    )
  })

  it('returns full path when only two segments', () => {
    const short = '/aaaa/bbbb'
    expect(truncateDirectoryPath(short, 4)).toBe(short)
  })

  it('handles Windows backslash segments', () => {
    expect(truncateDirectoryPath('C:\\Users\\willie\\Documents\\photos')).toBe(
      '.../Documents/photos'
    )
  })
})

describe('setLeadingDirectoryToken / removeLeadingDirectoryToken', () => {
  it('prepends a %dir:% token when none present', () => {
    expect(setLeadingDirectoryToken('ComfyUI', '/tmp/out')).toBe(
      '%dir:/tmp/out%ComfyUI'
    )
  })

  it('strips trailing separators from the path', () => {
    expect(setLeadingDirectoryToken('ComfyUI', '/tmp/out/')).toBe(
      '%dir:/tmp/out%ComfyUI'
    )
    expect(setLeadingDirectoryToken('ComfyUI', 'C:\\out\\')).toBe(
      '%dir:C:\\out%ComfyUI'
    )
  })

  it('replaces an existing leading token', () => {
    expect(
      setLeadingDirectoryToken('%dir:/old/path%ComfyUI', '/new/path')
    ).toBe('%dir:/new/path%ComfyUI')
  })

  it('removes an existing leading token', () => {
    expect(removeLeadingDirectoryToken('%dir:/a/b%ComfyUI')).toBe('ComfyUI')
  })

  it('leaves non-leading dir tokens alone when removing', () => {
    expect(removeLeadingDirectoryToken('text/%dir:/a%x')).toBe('text/%dir:/a%x')
  })
})

describe('parseTemplateSegments with context', () => {
  const ctx = () =>
    ({ graph: makeGraph(), node: makeNode('SaveImage') }) as never

  it('marks @groupTitle as missing when node has no parent group', () => {
    mockParentGroup.value = null
    expect(parseTemplateSegments('@groupTitle/file', ctx())).toEqual([
      { type: 'variable', name: 'groupTitle', prefix: '@', missing: true },
      { type: 'text', value: '/file' }
    ])
    mockParentGroup.value = { title: 'Render Group' }
  })

  it('leaves @groupTitle resolvable when a parent group exists', () => {
    mockParentGroup.value = { title: 'Render Group' }
    expect(parseTemplateSegments('@groupTitle/file', ctx())).toEqual([
      { type: 'variable', name: 'groupTitle', prefix: '@' },
      { type: 'text', value: '/file' }
    ])
  })
})

describe('isVariableResolvable', () => {
  const ctx = () =>
    ({ graph: makeGraph(), node: makeNode('SaveImage') }) as never

  it('returns false for groupTitle when node has no parent group', () => {
    mockParentGroup.value = null
    expect(isVariableResolvable('groupTitle', ctx())).toBe(false)
    mockParentGroup.value = { title: 'Render Group' }
  })

  it('returns true for date variables unconditionally', () => {
    expect(isVariableResolvable('DateYYYY', ctx())).toBe(true)
  })

  it('returns false for unknown variable names', () => {
    expect(isVariableResolvable('notARealVar', ctx())).toBe(false)
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
