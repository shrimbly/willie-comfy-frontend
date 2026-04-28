// Keep in sync with FAVORITE_COLORS in
// src/platform/assets/composables/useAssetFavorites.ts
export const FAVORITE_FILTER_OPTIONS = ['yellow', 'blue', 'green'] as const

export type MetadataField =
  | 'model'
  | 'lora'
  | 'workflowTitle'
  | 'prompt'
  | 'date'
  | 'tag'
  | 'type'
  | 'favorite'

export interface MetadataFilter {
  field: MetadataField
  value: string
}

const PROMPT_METADATA_FIELDS: MetadataField[] = [
  'model',
  'lora',
  'workflowTitle',
  'prompt'
]

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'

export const DATE_PRESETS: DatePreset[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth'
]

export const MEDIA_TYPE_OPTIONS = ['image', 'video', 'audio', '3D'] as const

export function isPromptMetadataField(
  field: MetadataField
): field is 'model' | 'lora' | 'workflowTitle' | 'prompt' {
  return (PROMPT_METADATA_FIELDS as string[]).includes(field)
}

export function getDateRangeForPreset(preset: DatePreset): {
  start: Date
  end: Date
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  switch (preset) {
    case 'today':
      return { start: today, end: tomorrow }

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { start: yesterday, end: today }
    }

    case 'thisWeek': {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      return { start: startOfWeek, end: tomorrow }
    }

    case 'lastWeek': {
      const startOfThisWeek = new Date(today)
      startOfThisWeek.setDate(
        startOfThisWeek.getDate() - startOfThisWeek.getDay()
      )
      const startOfLastWeek = new Date(startOfThisWeek)
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)
      return { start: startOfLastWeek, end: startOfThisWeek }
    }

    case 'thisMonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: startOfMonth, end: tomorrow }
    }

    case 'lastMonth': {
      const startOfLastMonth = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      )
      const startOfThisMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
      return { start: startOfLastMonth, end: startOfThisMonth }
    }
  }
}
