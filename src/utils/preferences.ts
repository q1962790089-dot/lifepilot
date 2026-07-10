import type { LifePilotPreferences } from '../types/preferences'

const PREFERENCES_KEY = 'lifepilot_preferences'
const ONBOARDING_COMPLETED_KEY = 'lifepilot_onboarding_completed'

export const DEFAULT_PREFERENCES: LifePilotPreferences = {
  persona: 'gentle',
  address: '你',
  customAddress: '',
  replyLength: 'normal',
  initiative: 'low',
  emojiUsage: 'none',
  focusAreas: [],
}

const PERSONAS = ['clear', 'gentle', 'intimate']
const ADDRESSES = ['你', '名字', '宝宝', 'custom']
const REPLY_LENGTHS = ['short', 'normal']
const INITIATIVES = ['low', 'medium']
const EMOJI_USAGES = ['none', 'occasional']
const FOCUS_AREAS = [
  'record_life',
  'plan_tasks',
  'chat_companion',
  'self_observation',
  'health_exercise',
  'expense_tracking',
]

function isOneOf<T extends string>(value: unknown, options: T[]): value is T {
  return typeof value === 'string' && options.includes(value as T)
}

export function normalizePreferences(value: unknown): LifePilotPreferences {
  const input = typeof value === 'object' && value !== null
    ? value as Partial<LifePilotPreferences>
    : {}

  return {
    persona: isOneOf(input.persona, PERSONAS) ? input.persona : DEFAULT_PREFERENCES.persona,
    address: isOneOf(input.address, ADDRESSES) ? input.address : DEFAULT_PREFERENCES.address,
    customAddress: typeof input.customAddress === 'string' ? input.customAddress : '',
    replyLength: isOneOf(input.replyLength, REPLY_LENGTHS) ? input.replyLength : DEFAULT_PREFERENCES.replyLength,
    initiative: isOneOf(input.initiative, INITIATIVES) ? input.initiative : DEFAULT_PREFERENCES.initiative,
    emojiUsage: isOneOf(input.emojiUsage, EMOJI_USAGES) ? input.emojiUsage : DEFAULT_PREFERENCES.emojiUsage,
    focusAreas: Array.isArray(input.focusAreas)
      ? input.focusAreas.filter((area): area is LifePilotPreferences['focusAreas'][number] => isOneOf(area, FOCUS_AREAS))
      : [],
  }
}

export function loadPreferences(): LifePilotPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    if (raw) return normalizePreferences(JSON.parse(raw))
  } catch {
    // Ignore invalid preference data and use defaults.
  }

  return DEFAULT_PREFERENCES
}

export function savePreferences(preferences: LifePilotPreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)))
}

export function getAddressText(preferences: LifePilotPreferences) {
  if (preferences.address === 'custom') return preferences.customAddress.trim()
  if (preferences.address === '名字') return preferences.customAddress.trim()
  if (preferences.address === '你') return ''
  return preferences.address
}

export function hasStoredPreferences() {
  return localStorage.getItem(PREFERENCES_KEY) !== null
}

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
}

export function shouldShowOnboarding() {
  return !hasStoredPreferences() && !hasCompletedOnboarding()
}

export function completeOnboarding(preferences: LifePilotPreferences) {
  savePreferences(preferences)
  localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
}

export function resetPreferences() {
  savePreferences(DEFAULT_PREFERENCES)
  return DEFAULT_PREFERENCES
}
