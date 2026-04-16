<template>
  <div class="date-range-filter">
    <div class="mb-2 flex items-center justify-between">
      <label class="filter-label">{{ $t('assets.filters.dateRange') }}</label>
      <Button
        v-if="modelValue && modelValue.length === 2"
        variant="text"
        size="small"
        class="filter-clear-btn h-auto! p-1!"
        @click="handleClear"
      >
        {{ $t('g.clear') }}
      </Button>
    </div>

    <DatePicker
      v-model="localValue"
      selection-mode="range"
      :manual-input="false"
      show-button-bar
      date-format="yy-mm-dd"
      :max-date="new Date()"
      :placeholder="$t('assets.filters.selectDateRange')"
      class="date-picker-small w-full"
      @update:model-value="handleDateChange"
    />

    <div
      v-if="modelValue && modelValue.length === 2"
      class="filter-date-display"
    >
      {{ formatDateRange(modelValue) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'

interface Props {
  modelValue?: [Date, Date] | null
}

interface Emits {
  (e: 'update:modelValue', value: [Date, Date] | null): void
  (e: 'clear'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localValue = ref<[Date, Date] | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (newValue) => {
    localValue.value = newValue ?? null
  }
)

const handleDateChange = (
  value: Date | Date[] | (Date | null)[] | null | undefined
) => {
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    emit('update:modelValue', [value[0], value[1]])
  } else {
    emit('update:modelValue', null)
  }
}

const handleClear = () => {
  localValue.value = null
  emit('update:modelValue', null)
  emit('clear')
}

const formatDateRange = (range: [Date, Date]): string => {
  const [start, end] = range
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }
  return `${formatDate(start)} - ${formatDate(end)}`
}
</script>

<style scoped>
.date-range-filter {
  padding: 0.75rem;
}

.filter-label {
  font-size: 0.75rem; /* 12px */
  font-weight: 500;
  color: var(--p-text-color);
}

.filter-clear-btn {
  font-size: 0.6875rem; /* 11px */
}

.filter-date-display {
  margin-top: 0.5rem;
  font-size: 0.6875rem; /* 11px */
  color: var(--p-text-muted-color);
}

.date-picker-small :deep(.p-datepicker) {
  font-size: 0.75rem; /* 12px */
}

.date-picker-small :deep(.p-inputtext) {
  font-size: 0.75rem; /* 12px */
  padding: 0.375rem 0.5rem;
}
</style>
