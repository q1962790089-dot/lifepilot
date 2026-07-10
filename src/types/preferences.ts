export type Persona = 'clear' | 'gentle' | 'intimate'
export type Address = '你' | '名字' | '宝宝' | 'custom'
export type ReplyLength = 'short' | 'normal'
export type Initiative = 'low' | 'medium'
export type EmojiUsage = 'none' | 'occasional'
export type PersonalityGroup = 'analyst' | 'diplomat' | 'sentinel' | 'explorer'
export type ExperienceMode = 'planner' | 'companion' | 'observer' | 'flexible'
export type SummaryStyle = 'concrete' | 'pattern'
export type HomePriority = 'plans' | 'chat' | 'insights' | 'quickCapture'
export type ThemeAccent = 'purple' | 'green' | 'blue' | 'amber'
export type FocusArea =
  | 'record_life'
  | 'plan_tasks'
  | 'chat_companion'
  | 'self_observation'
  | 'health_exercise'
  | 'expense_tracking'

export interface LifePilotPreferences {
  persona: Persona
  address: Address
  customAddress: string
  replyLength: ReplyLength
  initiative: Initiative
  emojiUsage: EmojiUsage
  focusAreas: FocusArea[]
  selfReportedPersonalityType?: string
  personalityGroup?: PersonalityGroup
  personalityRecommendationAccepted: boolean
  experienceMode: ExperienceMode
  summaryStyle: SummaryStyle
  homePriority: HomePriority
  themeAccent: ThemeAccent
  manualOverrides: string[]
}
