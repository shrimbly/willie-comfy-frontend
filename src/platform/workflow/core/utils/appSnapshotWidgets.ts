import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  AppSnapshotInput,
  AppSnapshotOutput
} from '@/platform/workflow/validation/schemas/appSnapshotSchema'

type InputType = AppSnapshotInput['type']
type OutputType = AppSnapshotOutput['type']

function inferMediaType(
  classType: string,
  inputName: string
): InputType | null {
  const nodeType = classType.toLowerCase()
  const name = inputName.toLowerCase()
  const tokens = name.split(/[^a-z0-9]+/)
  const qualifiers = new Set([
    'file',
    'path',
    'filename',
    'source',
    'input',
    'upload'
  ])
  const mediaTypes: InputType[] = ['video', 'audio', 'image']
  const mediaType = mediaTypes.find(
    (type) =>
      name === type ||
      (tokens.includes(type) && tokens.some((token) => qualifiers.has(token)))
  )
  if (mediaType) return mediaType
  if (!['file', 'path', 'filename'].includes(name)) return null
  if (nodeType.includes('video')) return 'video'
  if (nodeType.includes('audio')) return 'audio'
  if (nodeType.includes('image')) return 'image'
  return null
}

export function inferAppSnapshotInputType(
  widget: IBaseWidget,
  classType: string,
  inputName: string
): InputType {
  if (widget.type === 'toggle') return 'boolean'
  if (['number', 'slider', 'gradientslider', 'knob'].includes(widget.type)) {
    return 'number'
  }
  if (widget.type === 'color') return 'color'
  if (['string', 'text', 'textarea'].includes(widget.type)) return 'text'
  const mediaType = inferMediaType(classType, inputName)
  if (mediaType) return mediaType
  if (widget.type === 'fileupload' || widget.type === 'asset') return 'file'
  if (widget.type === 'combo' || widget.type === 'selectbutton') return 'select'
  return 'custom'
}

export function getAppSnapshotComboOptions(
  widget: IBaseWidget,
  node: LGraphNode
): AppSnapshotInput['options'] {
  let values = widget.options.values
  if (typeof values === 'function') {
    try {
      values = values(widget, node)
    } catch {
      return undefined
    }
  }

  const entries: [string | number, string][] = Array.isArray(values)
    ? values.flatMap((value): [string | number, string][] =>
        typeof value === 'string' || typeof value === 'number'
          ? [[value, String(value)]]
          : []
      )
    : values && typeof values === 'object'
      ? Object.entries(values).map(([value, label]) => [value, String(label)])
      : []

  return entries.map(([value, fallbackLabel]) => {
    try {
      return {
        value,
        label: widget.options.getOptionLabel?.(String(value)) ?? fallbackLabel
      }
    } catch {
      return { value, label: fallbackLabel }
    }
  })
}

function outputTypeFromNames(names: string[]): OutputType | null {
  const normalized = names.map((name) => name.toLowerCase())
  if (normalized.some((name) => name.includes('video'))) return 'video'
  if (normalized.some((name) => name.includes('audio'))) return 'audio'
  if (
    normalized.some((name) => name.includes('image') || name.includes('mask'))
  ) {
    return 'image'
  }
  return null
}

export function inferAppSnapshotOutputType(
  classType: string,
  outputs: LGraphNode['outputs'] = []
): OutputType {
  const slotTypes = outputs.flatMap((output) => {
    if (Array.isArray(output.type)) return output.type.map(String)
    return output.type === undefined ? [] : [String(output.type)]
  })
  const slotType = outputTypeFromNames(slotTypes)
  if (slotType) return slotType

  const value = classType.toLowerCase()
  const convertedType = /to(?:_|-)?(video|audio|image)/.exec(value)?.[1]
  if (
    convertedType === 'video' ||
    convertedType === 'audio' ||
    convertedType === 'image'
  ) {
    return convertedType
  }
  if (
    value.includes('video') ||
    value.includes('webm') ||
    value.includes('mp4')
  ) {
    return 'video'
  }
  if (value.includes('audio')) return 'audio'
  if (value.includes('image') || value.includes('mask')) return 'image'
  return 'file'
}
