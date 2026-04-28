import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

import { useGraphHierarchy } from '@/composables/graph/useGraphHierarchy'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

interface TemplateVariable {
  name: string
  description: string
}

// eslint-disable-next-line no-control-regex
const FILESYSTEM_INVALID_CHARS = /[/?<>\\:*|"\x00-\x1F\x7F]/g

export const BUILT_IN_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'project', description: 'templateVariables.projectDesc' },
  { name: 'workflowTitle', description: 'templateVariables.workflowTitleDesc' },
  { name: 'groupTitle', description: 'templateVariables.groupTitleDesc' },
  { name: 'nodeTitle', description: 'templateVariables.nodeTitleDesc' }
]

const BUILT_IN_NAMES = new Set(BUILT_IN_TEMPLATE_VARIABLES.map((v) => v.name))

function sanitize(value: string): string {
  return value.replaceAll(FILESYSTEM_INVALID_CHARS, '_')
}

type VariableResolver = (
  graph: LGraph | Subgraph,
  node: LGraphNode
) => string | null

const resolvers: Record<string, VariableResolver> = {
  project: () => 'My-project',
  workflowTitle: () => useWorkflowStore().activeWorkflow?.filename ?? null,
  groupTitle: (_graph, node) =>
    useGraphHierarchy().findParentGroup(node)?.title ?? null,
  nodeTitle: (_graph, node) => node.title ?? null
}

function getCustomVariables(): TemplateVariable[] {
  const custom = useSettingStore().get('Comfy.Filename.CustomVariables')
  return custom.map((v) => ({
    name: v.name,
    description: v.value
  }))
}

export function getCustomTemplateVariableValues(): {
  name: string
  value: string
}[] {
  return useSettingStore().get('Comfy.Filename.CustomVariables')
}

function getCustomVariableValue(name: string): string | null {
  const custom = useSettingStore().get('Comfy.Filename.CustomVariables')
  const found = custom.find((v) => v.name === name)
  return found?.value ?? null
}

function resolveVariable(
  name: string,
  graph: LGraph | Subgraph,
  node: LGraphNode
): string | null {
  const resolver = resolvers[name]
  if (resolver) return resolver(graph, node)
  return getCustomVariableValue(name)
}

interface TemplateContext {
  graph: LGraph | Subgraph
  node: LGraphNode
}

export function isVariableResolvable(
  name: string,
  context: TemplateContext
): boolean {
  return resolveVariable(name, context.graph, context.node) !== null
}

function getAllVariableNames(): Set<string> {
  const names = new Set(BUILT_IN_NAMES)
  for (const v of getCustomVariables()) {
    names.add(v.name)
  }
  return names
}

export function resolveTemplateVariables(
  graph: LGraph | Subgraph,
  node: LGraphNode,
  value: string
): string {
  return value.replace(/@(\w+)/g, (match, name: string) => {
    const resolved = resolveVariable(name, graph, node)
    if (resolved === null) return match
    return sanitize(resolved)
  })
}

export type TemplateSegment =
  | { type: 'text'; value: string }
  | {
      type: 'variable'
      name: string
      prefix: '@' | '%'
      missing?: boolean
    }
  | { type: 'directory'; path: string; isAbsolute: boolean }

const RUNTIME_TOKEN_NAMES = new Set([
  'width',
  'height',
  'batch_num',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second'
])

const NODE_WIDGET_PATTERN = /^[^.%\s][^.%]*\.[^.%\s]+$/
const DATE_FORMAT_PATTERN = /^date:.+$/
const DIR_TOKEN_PATTERN = /^dir:(.+)$/
const LEADING_DIR_TOKEN_PATTERN = /^%dir:[^%]+%/
const WINDOWS_ABSOLUTE_PATTERN = /^[A-Za-z]:[\\/]/

export function isAbsolutePath(path: string): boolean {
  if (!path) return false
  if (path.startsWith('/')) return true
  if (path.startsWith('~')) return true
  if (path.startsWith('\\\\')) return true
  return WINDOWS_ABSOLUTE_PATTERN.test(path)
}

export function truncateDirectoryPath(path: string, maxLen = 28): string {
  if (!path) return ''
  if (path.length <= maxLen) return path
  const segments = path.split(/[/\\]/).filter(Boolean)
  if (segments.length <= 2) return path
  const tail = segments.slice(-2).join('/')
  return `.../${tail}`
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/[/\\]+$/, '')
}

export function setLeadingDirectoryToken(value: string, path: string): string {
  const cleaned = stripTrailingSeparators(path)
  const rest = value.replace(LEADING_DIR_TOKEN_PATTERN, '')
  return `%dir:${cleaned}%${rest}`
}

export function removeLeadingDirectoryToken(value: string): string {
  return value.replace(LEADING_DIR_TOKEN_PATTERN, '')
}

export function resolveDirectoryTokens(value: string): string {
  return value.replace(/%dir:([^%]+)%[/\\]*/g, (_match, path: string) => {
    return `${stripTrailingSeparators(path)}/`
  })
}

function isKnownPercentToken(inner: string): boolean {
  if (RUNTIME_TOKEN_NAMES.has(inner)) return true
  if (DATE_FORMAT_PATTERN.test(inner)) return true
  if (NODE_WIDGET_PATTERN.test(inner)) return true
  if (DIR_TOKEN_PATTERN.test(inner)) return true
  return false
}

export function parseTemplateSegments(
  value: string,
  context?: TemplateContext
): TemplateSegment[] {
  const variableNames = getAllVariableNames()
  const segments: TemplateSegment[] = []
  let lastIndex = 0

  const combined = /@(\w+)|%([^%]+)%/g
  for (const match of value.matchAll(combined)) {
    const atName = match[1]
    const percentInner = match[2]

    let name: string | null = null
    let prefix: '@' | '%' | null = null
    let missing = false
    if (atName !== undefined) {
      name = atName
      prefix = '@'
      if (!variableNames.has(atName)) {
        missing = true
      } else if (context && !isVariableResolvable(atName, context)) {
        missing = true
      }
    } else if (
      percentInner !== undefined &&
      isKnownPercentToken(percentInner)
    ) {
      name = percentInner
      prefix = '%'
    }
    if (name === null || prefix === null) continue

    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: value.slice(lastIndex, match.index)
      })
    }

    const dirMatch = prefix === '%' ? DIR_TOKEN_PATTERN.exec(name) : null
    if (dirMatch) {
      const path = dirMatch[1]
      segments.push({
        type: 'directory',
        path,
        isAbsolute: isAbsolutePath(path)
      })
    } else {
      segments.push(
        missing
          ? { type: 'variable', name, prefix, missing: true }
          : { type: 'variable', name, prefix }
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return segments
}

export function previewResolvedValue(
  graph: LGraph | Subgraph,
  node: LGraphNode,
  value: string
): string {
  return value.replace(/@(\w+)/g, (match, name: string) => {
    const resolved = resolveVariable(name, graph, node)
    return resolved ?? match
  })
}

export function getTemplateVariables(): TemplateVariable[] {
  return [...BUILT_IN_TEMPLATE_VARIABLES, ...getCustomVariables()]
}
