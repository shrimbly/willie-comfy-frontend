<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-2xl font-bold">
        {{ $t('filenameVariables.title') }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ $t('filenameVariables.description') }}
      </p>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-semibold text-muted">
        {{ $t('filenameVariables.builtIn') }}
      </h3>
      <div class="flex flex-col gap-1">
        <div
          v-for="variable in builtInVariables"
          :key="variable.name"
          class="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted"
        >
          <span class="min-w-32 font-mono">@{{ variable.name }}</span>
          <span>{{ $t(variable.description) }}</span>
        </div>
      </div>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-semibold text-muted">
        {{ $t('filenameVariables.custom') }}
      </h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="(variable, index) in customVariables"
          :key="index"
          class="flex items-center gap-2"
        >
          <span class="text-sm text-muted">@</span>
          <input
            :value="variable.name"
            :placeholder="$t('filenameVariables.namePlaceholder')"
            :class="
              cn(
                'h-8 w-40 rounded-sm border bg-transparent px-2 text-sm',
                getNameError(variable.name, index)
                  ? 'border-red-500'
                  : 'border-border'
              )
            "
            @input="
              updateName(index, ($event.target as HTMLInputElement).value)
            "
          />
          <input
            :value="variable.value"
            :placeholder="$t('filenameVariables.valuePlaceholder')"
            class="border-border h-8 flex-1 rounded-sm border bg-transparent px-2 text-sm"
            @input="
              updateValue(index, ($event.target as HTMLInputElement).value)
            "
          />
          <Button
            variant="muted-textonly"
            size="icon"
            @click="removeVariable(index)"
          >
            <i class="icon-[lucide--trash-2] text-sm" />
          </Button>
        </div>
        <div
          v-for="(variable, index) in customVariables"
          :key="'error-' + index"
        >
          <p
            v-if="getNameError(variable.name, index)"
            class="text-xs text-red-500"
          >
            {{ getNameError(variable.name, index) }}
          </p>
        </div>
      </div>
      <Button variant="secondary" class="mt-3" @click="addVariable">
        <i class="mr-1 icon-[lucide--plus] text-sm" />
        {{ $t('filenameVariables.addVariable') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { BUILT_IN_TEMPLATE_VARIABLES } from '@/utils/templateVariableResolver'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const settingStore = useSettingStore()

const builtInVariables = BUILT_IN_TEMPLATE_VARIABLES

const builtInNames = new Set(builtInVariables.map((v) => v.name))

const customVariables = ref<{ name: string; value: string }[]>(
  structuredClone(settingStore.get('Comfy.Filename.CustomVariables'))
)

const VALID_NAME_RE = /^\w+$/

function getNameError(name: string, index: number): string | null {
  if (!name) return t('filenameVariables.nameEmpty')
  if (!VALID_NAME_RE.test(name)) return t('filenameVariables.nameInvalid')
  if (builtInNames.has(name)) return t('filenameVariables.nameConflict')
  const duplicate = customVariables.value.some(
    (v, i) => i !== index && v.name === name
  )
  if (duplicate) return t('filenameVariables.nameDuplicate')
  return null
}

function hasAnyError(): boolean {
  return customVariables.value.some((v, i) => getNameError(v.name, i) !== null)
}

function persist() {
  if (hasAnyError()) return
  void settingStore.set(
    'Comfy.Filename.CustomVariables',
    customVariables.value.map((v) => ({ name: v.name, value: v.value }))
  )
}

function addVariable() {
  customVariables.value.push({ name: '', value: '' })
}

function removeVariable(index: number) {
  customVariables.value.splice(index, 1)
  persist()
}

function updateName(index: number, value: string) {
  customVariables.value[index].name = value
  persist()
}

function updateValue(index: number, value: string) {
  customVariables.value[index].value = value
  persist()
}

watch(
  () => settingStore.get('Comfy.Filename.CustomVariables'),
  (newVal) => {
    customVariables.value = structuredClone(newVal)
  }
)
</script>
