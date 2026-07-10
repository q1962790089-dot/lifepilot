import type { LifePilotPreferences, ThemeAccent } from '../types/preferences'

export const ACCENT_THEME: Record<ThemeAccent, {
  accent: string
  soft: string
  text: string
  ring: string
}> = {
  purple: { accent: '#7c3aed', soft: '#f5f3ff', text: '#6d28d9', ring: '#ede9fe' },
  green: { accent: '#059669', soft: '#ecfdf5', text: '#047857', ring: '#d1fae5' },
  blue: { accent: '#2563eb', soft: '#eff6ff', text: '#1d4ed8', ring: '#dbeafe' },
  amber: { accent: '#d97706', soft: '#fffbeb', text: '#b45309', ring: '#fef3c7' },
}

export function getPersonalityStatus(preferences: LifePilotPreferences) {
  if (!preferences.personalityRecommendationAccepted || !preferences.selfReportedPersonalityType) {
    return null
  }

  const priority = preferences.homePriority === 'plans' ? '计划优先' : preferences.experienceMode === 'planner'
    ? '计划模式'
    : '灵活记录'
  const persona = preferences.persona === 'clear' ? '清醒型' : preferences.persona === 'gentle' ? '温柔型' : '亲密型'

  return `${preferences.selfReportedPersonalityType} · ${priority} · ${persona}`
}
