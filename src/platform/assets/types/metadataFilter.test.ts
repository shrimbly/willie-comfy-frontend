import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDateRangeForPreset, isPromptMetadataField } from './metadataFilter'

describe('isPromptMetadataField', () => {
  it('returns true for prompt metadata fields', () => {
    expect(isPromptMetadataField('model')).toBe(true)
    expect(isPromptMetadataField('lora')).toBe(true)
    expect(isPromptMetadataField('workflowTitle')).toBe(true)
    expect(isPromptMetadataField('prompt')).toBe(true)
  })

  it('returns false for asset-level fields', () => {
    expect(isPromptMetadataField('date')).toBe(false)
    expect(isPromptMetadataField('tag')).toBe(false)
    expect(isPromptMetadataField('type')).toBe(false)
  })
})

describe('getDateRangeForPreset', () => {
  beforeEach(() => {
    // Fix time to Wednesday, 2025-03-12 14:30:00
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 2, 12, 14, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today midnight to tomorrow midnight for "today"', () => {
    const { start, end } = getDateRangeForPreset('today')
    expect(start).toEqual(new Date(2025, 2, 12))
    expect(end).toEqual(new Date(2025, 2, 13))
  })

  it('returns yesterday midnight to today midnight for "yesterday"', () => {
    const { start, end } = getDateRangeForPreset('yesterday')
    expect(start).toEqual(new Date(2025, 2, 11))
    expect(end).toEqual(new Date(2025, 2, 12))
  })

  it('returns start of this week (Sunday) to tomorrow for "thisWeek"', () => {
    // March 12 2025 is a Wednesday, so start of week is Sunday March 9
    const { start, end } = getDateRangeForPreset('thisWeek')
    expect(start).toEqual(new Date(2025, 2, 9))
    expect(end).toEqual(new Date(2025, 2, 13))
  })

  it('returns last week range for "lastWeek"', () => {
    // Start of this week is Sunday March 9, so last week is March 2 - March 9
    const { start, end } = getDateRangeForPreset('lastWeek')
    expect(start).toEqual(new Date(2025, 2, 2))
    expect(end).toEqual(new Date(2025, 2, 9))
  })

  it('returns first of this month to tomorrow for "thisMonth"', () => {
    const { start, end } = getDateRangeForPreset('thisMonth')
    expect(start).toEqual(new Date(2025, 2, 1))
    expect(end).toEqual(new Date(2025, 2, 13))
  })

  it('returns last month range for "lastMonth"', () => {
    const { start, end } = getDateRangeForPreset('lastMonth')
    expect(start).toEqual(new Date(2025, 1, 1))
    expect(end).toEqual(new Date(2025, 2, 1))
  })
})
