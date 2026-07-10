export type Persona = 'clear' | 'gentle' | 'intimate'
export type Address = '你' | '名字' | '宝宝' | 'custom'
export type ReplyLength = 'short' | 'normal'
export type Initiative = 'low' | 'medium'
export type EmojiUsage = 'none' | 'occasional'

export interface LifePilotPreferences {
  persona: Persona
  address: Address
  customAddress: string
  replyLength: ReplyLength
  initiative: Initiative
  emojiUsage: EmojiUsage
}
