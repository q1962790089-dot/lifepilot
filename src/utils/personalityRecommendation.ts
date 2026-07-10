import type {
  ExperienceMode,
  HomePriority,
  LifePilotPreferences,
  Persona,
  PersonalityGroup,
  ReplyLength,
  SummaryStyle,
  ThemeAccent,
} from '../types/preferences'
import { createRecommendedLayout } from './homeLayout'
import { normalizePreferences } from './preferences'

export const PERSONALITY_TYPES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
]

export const PERSONALITY_GROUPS: Record<PersonalityGroup, { label: string; types: string[]; accent: ThemeAccent }> = {
  analyst: { label: 'NT', types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'], accent: 'purple' },
  diplomat: { label: 'NF', types: ['INFJ', 'INFP', 'ENFJ', 'ENFP'], accent: 'green' },
  sentinel: { label: 'SJ', types: ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'], accent: 'blue' },
  explorer: { label: 'SP', types: ['ISTP', 'ISFP', 'ESTP', 'ESFP'], accent: 'amber' },
}

export interface PersonalityRecommendation {
  type: string
  group: PersonalityGroup
  persona: Persona
  initiative: LifePilotPreferences['initiative']
  replyLength: ReplyLength
  experienceMode: ExperienceMode
  summaryStyle: SummaryStyle
  homePriority: HomePriority
  themeAccent: ThemeAccent
  title: string
  bullets: string[]
}

const ACCENT_TEXT: Record<ThemeAccent, string> = {
  purple: '紫色轻主题',
  green: '绿色轻主题',
  blue: '蓝色轻主题',
  amber: '琥珀色轻主题',
}

const HOME_TEXT: Record<HomePriority, string> = {
  plans: '计划与待办优先',
  chat: '聊天和日记入口更突出',
  insights: '总结、标签和时间线更突出',
  quickCapture: '快速记录更突出',
}

function getPersonalityGroup(type: string): PersonalityGroup {
  if (type.includes('NT')) return 'analyst'
  if (type.includes('NF')) return 'diplomat'
  if (type.includes('SJ')) return 'sentinel'
  return 'explorer'
}

function recommendExperienceMode(type: string, group: PersonalityGroup): ExperienceMode {
  if (group === 'diplomat') return 'companion'
  if (group === 'analyst') return type.includes('J') ? 'planner' : 'observer'
  if (type.includes('J')) return 'planner'
  return 'flexible'
}

function modeFromFocusAreas(preferences: LifePilotPreferences): ExperienceMode | null {
  if (preferences.focusAreas.includes('plan_tasks')) return 'planner'
  if (preferences.focusAreas.includes('chat_companion')) return 'companion'
  if (preferences.focusAreas.includes('self_observation')) return 'observer'
  if (preferences.focusAreas.includes('record_life')) return 'flexible'
  return null
}

function homePriorityForMode(experienceMode: ExperienceMode): HomePriority {
  if (experienceMode === 'planner') return 'plans'
  if (experienceMode === 'companion') return 'chat'
  if (experienceMode === 'observer') return 'insights'
  return 'quickCapture'
}

export function createPersonalityRecommendation(type: string): PersonalityRecommendation | null {
  const normalized = type.trim().toUpperCase()
  if (!PERSONALITY_TYPES.includes(normalized)) return null

  const group = getPersonalityGroup(normalized)
  const experienceMode = recommendExperienceMode(normalized, group)
  const persona: Persona = experienceMode === 'planner' || normalized.includes('T') ? 'clear' : 'gentle'
  const initiative: LifePilotPreferences['initiative'] = normalized.includes('E') ? 'medium' : 'low'
  const replyLength: ReplyLength = experienceMode === 'flexible' ? 'short' : 'normal'
  const summaryStyle: SummaryStyle = normalized.includes('N') ? 'pattern' : 'concrete'
  const homePriority: HomePriority = experienceMode === 'planner'
    ? 'plans'
    : experienceMode === 'companion'
      ? 'chat'
      : experienceMode === 'observer'
        ? 'insights'
        : 'quickCapture'
  const themeAccent = PERSONALITY_GROUPS[group].accent

  return {
    type: normalized,
    group,
    persona,
    initiative,
    replyLength,
    experienceMode,
    summaryStyle,
    homePriority,
    themeAccent,
    title: `${homePriority === 'plans' ? '计划优先' : '灵活记录'} · ${persona === 'clear' ? '清醒型 AI' : '温柔型 AI'}`,
    bullets: [
      HOME_TEXT[homePriority],
      persona === 'clear' ? '回复简洁直接' : '回复温和自然',
      initiative === 'low' ? '较少主动打扰' : '适度主动提醒',
      summaryStyle === 'pattern' ? '总结更关注趋势和关联' : '总结更关注实际记录和事实',
      ACCENT_TEXT[themeAccent],
    ],
  }
}

function setIfAllowed<Key extends keyof LifePilotPreferences>(
  target: LifePilotPreferences,
  key: Key,
  value: LifePilotPreferences[Key],
  protectedFields: string[],
) {
  if (!protectedFields.includes(key)) {
    target[key] = value
  }
}

export function applyPersonalityRecommendation(
  preferences: LifePilotPreferences,
  recommendation: PersonalityRecommendation,
  extraProtectedFields: string[] = [],
) {
  const next = normalizePreferences(preferences)
  const inferredManualFields = next.personalityRecommendationAccepted ? [] : [
    next.persona !== 'gentle' ? 'persona' : '',
    next.initiative !== 'low' ? 'initiative' : '',
    next.replyLength !== 'normal' ? 'replyLength' : '',
    next.experienceMode !== 'flexible' ? 'experienceMode' : '',
    next.summaryStyle !== 'concrete' ? 'summaryStyle' : '',
    next.homePriority !== 'quickCapture' ? 'homePriority' : '',
    next.themeAccent !== 'purple' ? 'themeAccent' : '',
  ].filter(Boolean)
  const protectedFields = Array.from(new Set([...next.manualOverrides, ...inferredManualFields, ...extraProtectedFields]))

  setIfAllowed(next, 'persona', recommendation.persona, protectedFields)
  setIfAllowed(next, 'initiative', recommendation.initiative, protectedFields)
  setIfAllowed(next, 'replyLength', recommendation.replyLength, protectedFields)
  setIfAllowed(next, 'experienceMode', modeFromFocusAreas(next) ?? recommendation.experienceMode, protectedFields)
  setIfAllowed(next, 'summaryStyle', recommendation.summaryStyle, protectedFields)
  setIfAllowed(next, 'homePriority', homePriorityForMode(next.experienceMode), protectedFields)
  setIfAllowed(next, 'themeAccent', recommendation.themeAccent, protectedFields)

  if (!protectedFields.includes('layout')) {
    next.layout = createRecommendedLayout(next.experienceMode)
  }

  next.selfReportedPersonalityType = recommendation.type
  next.personalityGroup = recommendation.group
  next.personalityRecommendationAccepted = true
  next.manualOverrides = protectedFields

  return next
}

export function markManualOverride(preferences: LifePilotPreferences, field: string) {
  const next = normalizePreferences(preferences)
  next.manualOverrides = Array.from(new Set([...next.manualOverrides, field]))
  return next
}

export function clearPersonalityRecommendation(preferences: LifePilotPreferences) {
  const next = normalizePreferences(preferences)
  next.selfReportedPersonalityType = undefined
  next.personalityGroup = undefined
  next.personalityRecommendationAccepted = false
  return next
}
