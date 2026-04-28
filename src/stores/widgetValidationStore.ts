import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useWidgetValidationStore = defineStore('widgetValidation', () => {
  const invalidNodes = reactive<Record<string, boolean>>({})

  function setNodeInvalid(nodeLocatorId: string, invalid: boolean) {
    if (invalid) invalidNodes[nodeLocatorId] = true
    else delete invalidNodes[nodeLocatorId]
  }

  function isNodeInvalid(nodeLocatorId: string | null | undefined): boolean {
    if (!nodeLocatorId) return false
    return invalidNodes[nodeLocatorId] === true
  }

  return { setNodeInvalid, isNodeInvalid }
})
