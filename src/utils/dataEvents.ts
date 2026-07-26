export const DATA_CHANGED_EVENT = 'lifepilot:data-changed'

export function notifyDataChanged(source: string) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { source } }))
}
