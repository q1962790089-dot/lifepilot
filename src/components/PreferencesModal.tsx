import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Address, EmojiUsage, Initiative, LifePilotPreferences, Persona, ReplyLength } from '../types/preferences'
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
  const preview = useMemo(() => previewFor(draft), [draft])

  if (!open) return null

  const update = <Key extends keyof LifePilotPreferences>(key: Key, value: LifePilotPreferences[Key]) => {
    setSavedMessage('')
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSave = () => {
    savePreferences(draft)
    setSavedMessage('已保存，下一条回复开始生效。')
  }

  const handleReset = () => {
    const defaults = resetPreferences()
    setDraft(defaults)
    setSavedMessage('已恢复默认设置，下一条回复开始生效。')
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
