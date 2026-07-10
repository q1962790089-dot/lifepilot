import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Address, EmojiUsage, Initiative, LifePilotPreferences, Persona, ReplyLength } from '../types/preferences'
import {
  applyPersonalityRecommendation,
  clearPersonalityRecommendation,
  createPersonalityRecommendation,
  markManualOverride,
  PERSONALITY_GROUPS,
} from '../utils/personalityRecommendation'
import { getAddressText, loadPreferences, resetPreferences, savePreferences } from '../utils/preferences'

interface PreferencesModalProps {
  open: boolean
  onClose: () => void
}

const PERSONA_OPTIONS: { value: Persona; label: string; description: string }[] = [
  { value: 'clear', label: '清醒型', description: '冷静、简洁、直接，更偏向整理和行动。' },
  { value: 'gentle', label: '温柔型', description: '温和自然，有适度陪伴感，不过度安慰。' },
  { value: 'intimate', label: '亲密型', description: '更亲近，会使用你选择的称呼，但保持克制。' },
]

const ADDRESS_OPTIONS: { value: Address; label: string }[] = [
  { value: '你', label: '你' },
  { value: '名字', label: '名字' },
  { value: '宝宝', label: '宝宝' },
  { value: 'custom', label: '自定义称呼' },
]

const REPLY_LENGTH_OPTIONS: { value: ReplyLength; label: string }[] = [
  { value: 'short', label: '简短' },
  { value: 'normal', label: '适中' },
]

const INITIATIVE_OPTIONS: { value: Initiative; label: string }[] = [
  { value: 'low', label: '少打扰' },
  { value: 'medium', label: '适度提醒' },
]

const EMOJI_OPTIONS: { value: EmojiUsage; label: string }[] = [
  { value: 'none', label: '不使用' },
  { value: 'occasional', label: '偶尔使用' },
]

const EXPERIENCE_MODE_LABELS: Record<LifePilotPreferences['experienceMode'], string> = {
  planner: '计划优先',
  companion: '陪伴记录',
  observer: '观察总结',
  flexible: '灵活记录',
}

const ACCENT_CLASS = {
  purple: 'bg-violet-50 text-violet-700 ring-violet-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
}

function previewFor(preferences: LifePilotPreferences) {
  if (preferences.persona === 'clear') {
    return '已记录。今晚可以减少非必要安排，优先休息。'
  }

  if (preferences.persona === 'gentle') {
    return '听起来今天消耗有点大，我帮你记下来了。今晚先让自己轻松一点。'
  }

  const address = getAddressText(preferences)
  return `${address ? `辛苦啦，${address}。` : '辛苦啦。'}我帮你记下来了，今晚先别给自己安排太多事情。`
}

function OptionGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: { value: T; label: string; description?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-2xl px-3 py-2.5 text-left ring-1 transition-colors ${
              value === option.value
                ? 'bg-gray-950 text-white ring-gray-950'
                : 'bg-gray-50 text-gray-700 ring-black/5'
            }`}
          >
            <span className="text-sm font-medium">{option.label}</span>
            {option.description && (
              <span className={`mt-1 block text-xs leading-relaxed ${value === option.value ? 'text-white/65' : 'text-gray-400'}`}>
                {option.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}

function InlineOptions<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              value === option.value ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-500 ring-1 ring-black/5'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  const [draft, setDraft] = useState<LifePilotPreferences>(() => loadPreferences())
  const [savedMessage, setSavedMessage] = useState('')
  const [showPersonalityPicker, setShowPersonalityPicker] = useState(false)
  const [selectedPersonalityType, setSelectedPersonalityType] = useState('')
  const preview = useMemo(() => previewFor(draft), [draft])
  const personalityRecommendation = useMemo(
    () => selectedPersonalityType ? createPersonalityRecommendation(selectedPersonalityType) : null,
    [selectedPersonalityType],
  )

  if (!open) return null

  const update = <Key extends keyof LifePilotPreferences>(key: Key, value: LifePilotPreferences[Key]) => {
    setSavedMessage('')
    setDraft((current) => markManualOverride({ ...current, [key]: value }, key))
  }

  const handleSave = () => {
    savePreferences(draft)
    setSavedMessage('已保存，下一条回复开始生效。')
  }

  const handleReset = () => {
    const defaults = resetPreferences()
    setDraft(defaults)
    setSelectedPersonalityType('')
    setShowPersonalityPicker(false)
    setSavedMessage('已恢复默认设置，下一条回复开始生效。')
  }

  const handleClearPersonality = () => {
    setDraft((current) => clearPersonalityRecommendation(current))
    setSelectedPersonalityType('')
    setShowPersonalityPicker(false)
    setSavedMessage('已清除人格偏好，历史记录不会受影响。')
  }

  const handleUsePersonalityRecommendation = () => {
    if (!personalityRecommendation) return
    setDraft((current) => applyPersonalityRecommendation(current, personalityRecommendation))
    setShowPersonalityPicker(false)
    setSavedMessage('已应用推荐，仍然可以继续手动调整。')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-gray-950/25 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="max-h-full w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:max-w-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">AI 交流设置</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">只调整表达风格，不会影响你的记录和历史数据。</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 ring-1 ring-black/5"
            aria-label="关闭设置"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-5">
          <OptionGroup
            title="AI 风格"
            options={PERSONA_OPTIONS}
            value={draft.persona}
            onChange={(value) => update('persona', value)}
          />

          <InlineOptions
            title="称呼"
            options={ADDRESS_OPTIONS}
            value={draft.address}
            onChange={(value) => update('address', value)}
          />

          {draft.address === 'custom' && (
            <input
              value={draft.customAddress}
              onChange={(event) => update('customAddress', event.target.value)}
              placeholder="输入你想让 LifePilot 使用的称呼"
              className="w-full rounded-2xl border border-black/5 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-200"
            />
          )}

          <InlineOptions
            title="回复长度"
            options={REPLY_LENGTH_OPTIONS}
            value={draft.replyLength}
            onChange={(value) => update('replyLength', value)}
          />

          <InlineOptions
            title="主动程度"
            options={INITIATIVE_OPTIONS}
            value={draft.initiative}
            onChange={(value) => update('initiative', value)}
          />

          <InlineOptions
            title="表情使用"
            options={EMOJI_OPTIONS}
            value={draft.emojiUsage}
            onChange={(value) => update('emojiUsage', value)}
          />

          <section className="rounded-3xl bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">人格偏好</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  人格偏好只影响推荐，不会删除或改变你的历史记录。
                </p>
              </div>
              {draft.personalityGroup && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ACCENT_CLASS[draft.themeAccent]}`}>
                  {draft.selfReportedPersonalityType}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
                当前类型：{draft.selfReportedPersonalityType ?? '未设置'}
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
                推荐模式：{EXPERIENCE_MODE_LABELS[draft.experienceMode]}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setShowPersonalityPicker((value) => !value)}
                className="rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-600 ring-1 ring-black/5"
              >
                {draft.selfReportedPersonalityType ? '修改类型' : '重新获取推荐'}
              </button>
              <button
                onClick={() => setShowPersonalityPicker(true)}
                className="rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-600 ring-1 ring-black/5"
              >
                重新获取推荐
              </button>
              <button
                onClick={handleClearPersonality}
                className="rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-400 ring-1 ring-black/5"
              >
                清除人格信息
              </button>
            </div>

            {showPersonalityPicker && (
              <div className="mt-3 space-y-3">
                {Object.entries(PERSONALITY_GROUPS).map(([group, meta]) => (
                  <div key={group}>
                    <span className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ACCENT_CLASS[meta.accent]}`}>
                      {meta.label}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {meta.types.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedPersonalityType(type)}
                          className={`rounded-2xl px-2 py-2 text-xs font-semibold ring-1 ${
                            selectedPersonalityType === type
                              ? 'bg-gray-950 text-white ring-gray-950'
                              : 'bg-white text-gray-500 ring-black/5'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {personalityRecommendation && (
                  <div className={`rounded-3xl p-3 ring-1 ${ACCENT_CLASS[personalityRecommendation.themeAccent]}`}>
                    <p className="text-sm font-semibold">{personalityRecommendation.title}</p>
                    <div className="mt-2 space-y-1">
                      {personalityRecommendation.bullets.map((item) => (
                        <p key={item} className="text-xs">{item}</p>
                      ))}
                    </div>
                    <button
                      onClick={handleUsePersonalityRecommendation}
                      className="mt-3 w-full rounded-full bg-gray-950 px-3 py-2 text-xs font-medium text-white"
                    >
                      使用推荐
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-400">预览：“今天有点累。”</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{preview}</p>
          </section>
        </div>

        {savedMessage && (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {savedMessage}
          </p>
        )}

        <button
          onClick={handleReset}
          className="mt-5 w-full rounded-full bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 ring-1 ring-black/5"
        >
          恢复默认设置
        </button>

        <button
          onClick={handleSave}
          className="mt-2 w-full rounded-full bg-gray-950 px-4 py-3 text-sm font-medium text-white"
        >
          保存设置
        </button>
      </div>
    </div>
  )
}

export default PreferencesModal
