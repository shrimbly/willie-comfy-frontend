import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  BUILT_IN_TEMPLATE_VARIABLES,
  getCustomTemplateVariableValues,
  isVariableResolvable
} from '@/utils/templateVariableResolver'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

export type TemplateSuggestionGroup = 'variable' | 'token' | 'date' | 'node'

export interface TemplateSuggestion {
  key: string
  label: string
  insertText: string
  description: string
  filterText: string
  group: TemplateSuggestionGroup
  isCustom?: boolean
}

interface StaticToken {
  token: string
  descKey: string
}

const RUNTIME_TOKENS: StaticToken[] = [
  { token: 'width', descKey: 'templateVariables.widthDesc' },
  { token: 'height', descKey: 'templateVariables.heightDesc' },
  { token: 'batch_num', descKey: 'templateVariables.batchNumDesc' }
]

interface DateFormat {
  format: string
}

const DATE_FORMAT_PRESETS: DateFormat[] = [
  { format: 'yyyyMMdd' },
  { format: 'yyyy-MM-dd-HHmm' },
  { format: 'HHmmss' }
]

export type TranslateFn = (
  key: string,
  values?: Record<string, string>
) => string

function buildVariableSuggestions(
  t: TranslateFn,
  graph: LGraph | Subgraph | null,
  node: LGraphNode | null
): TemplateSuggestion[] {
  const resolvableBuiltIns = BUILT_IN_TEMPLATE_VARIABLES.filter((v) => {
    if (!graph || !node) return true
    return isVariableResolvable(v.name, { graph, node })
  })
  const builtIn: TemplateSuggestion[] = resolvableBuiltIns.map((v) => ({
    key: `var:${v.name}`,
    label: v.name,
    insertText: `@${v.name}`,
    description: t(v.description),
    filterText: v.name.toLowerCase(),
    group: 'variable'
  }))
  const custom: TemplateSuggestion[] = getCustomTemplateVariableValues().map(
    (v) => ({
      key: `var:custom:${v.name}`,
      label: v.name,
      insertText: `@${v.name}`,
      description: v.value,
      filterText: v.name.toLowerCase(),
      group: 'variable',
      isCustom: true
    })
  )
  return [...builtIn, ...custom]
}

function buildTokenSuggestions(t: TranslateFn): TemplateSuggestion[] {
  return RUNTIME_TOKENS.map(({ token, descKey }) => ({
    key: `token:${token}`,
    label: token,
    insertText: `%${token}%`,
    description: t(descKey),
    filterText: token.toLowerCase(),
    group: 'token'
  }))
}

function buildDateSuggestions(t: TranslateFn): TemplateSuggestion[] {
  return DATE_FORMAT_PRESETS.map(({ format }) => ({
    key: `date:${format}`,
    label: `date:${format}`,
    insertText: `%date:${format}%`,
    description: t('templateVariables.dateFormatDesc', { format }),
    filterText: `date ${format}`.toLowerCase(),
    group: 'date'
  }))
}

function nodeRefName(node: {
  properties?: Record<string, unknown>
  title?: string
}): string | null {
  const prop = node.properties?.['Node name for S&R']
  if (typeof prop === 'string' && prop) return prop
  if (node.title) return node.title
  return null
}

function buildNodeSuggestions(
  graph: LGraph | Subgraph | null,
  t: TranslateFn
): TemplateSuggestion[] {
  if (!graph) return []

  const seen = new Set<string>()
  const suggestions: TemplateSuggestion[] = []

  for (const node of collectAllNodes(graph)) {
    const refName = nodeRefName(node)
    if (!refName) continue
    const widgets = node.widgets ?? []
    for (const widget of widgets) {
      if (!widget.name) continue
      const key = `${refName}.${widget.name}`
      if (seen.has(key)) continue
      seen.add(key)

      const valuePreview = formatWidgetValue(widget.value)
      const description = valuePreview
        ? t('templateVariables.nodeWidgetDesc', { value: valuePreview })
        : t('templateVariables.nodeWidgetDescEmpty')

      suggestions.push({
        key: `node:${key}`,
        label: key,
        insertText: `%${key}%`,
        description,
        filterText: key.toLowerCase(),
        group: 'node'
      })
    }
  }

  return suggestions
}

function formatWidgetValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.length <= 40) return str
  return `${str.slice(0, 37)}…`
}

export function buildTemplateSuggestions(
  graph: LGraph | Subgraph | null,
  t: TranslateFn,
  node: LGraphNode | null = null
): TemplateSuggestion[] {
  return [
    ...buildVariableSuggestions(t, graph, node),
    ...buildTokenSuggestions(t),
    ...buildDateSuggestions(t),
    ...buildNodeSuggestions(graph, t)
  ]
}

export const SUGGESTION_GROUP_ORDER: TemplateSuggestionGroup[] = [
  'variable',
  'token',
  'date',
  'node'
]

export function groupSuggestions(
  suggestions: TemplateSuggestion[]
): { group: TemplateSuggestionGroup; items: TemplateSuggestion[] }[] {
  const byGroup = new Map<TemplateSuggestionGroup, TemplateSuggestion[]>()
  for (const s of suggestions) {
    const existing = byGroup.get(s.group)
    if (existing) existing.push(s)
    else byGroup.set(s.group, [s])
  }
  return SUGGESTION_GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    items: byGroup.get(g)!
  }))
}
