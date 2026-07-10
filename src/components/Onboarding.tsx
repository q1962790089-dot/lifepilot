import { Check, ChevronRight, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Address, FocusArea, Initiative, LifePilotPreferences, Persona, ReplyLength } from '../types/preferences'
import {
  applyPersonalityRecommendation,
  createPersonalityRecommendation,
  markManualOverride,
  PERSONALITY_GROUPS,
} from '../utils/personalityRecommendation'
import { completeOnboarding, DEFAULT_PREFERENCES, getAddressText } from '../utils/preferences'

interface OnboardingProps {
  onComplete: () => void
}

const PERSONA_OPTIONS: { value: Persona; label: string; description: string; preview: string }[] = [
  {
    value: 'clear',
    label: '清醒型',
    description: '直接、简短、行动导向，适合整理计划和解决问题。',
    preview: '已记录。今晚可以减少非必要安排，优先休息。',
  },
  {
    value: 'gentle',
    label: '温柔型',
    description: '自然、温和，能接住情绪，也会给轻量建议。',
    preview: '听起来今天消耗有点大，我帮你记下来了。今晚先让自己轻松一点。',
  },
  {
    value: 'intimate',
    label: '亲密型',
    description: '更亲近、有陪伴感，但不油腻，也不制造依赖。',
    preview: '辛苦啦。我帮你记下来了，今晚先别给自己安排太多事情。',
  },
]

const FOCUS_OPTIONS: { value: FocusArea; label: string }[] = [
  { value: 'record_life', label: '记录生活' },
  { value: 'plan_tasks', label: '安排计划' },
  { value: 'chat_companion', label: '陪我聊天' },
  { value: 'self_observation', label: '观察自己的状态' },
  { value: 'health_exercise', label: '健康与运动' },
  { value: 'expense_tracking', label: '消费记录' },
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

const ACCENT_CLASS = {
  purple: 'bg-violet-50 text-violet-700 ring-violet-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
}

function previewFor(preferences: LifePilotPreferences) {
  if (preferences.persona === 'clear') return PERSONA_OPTIONS[0].preview
  if (preferences.persona === 'gentle') return PERSONA_OPTIONS[1].preview
  const address = getAddressText(preferences)
  return `${address ? `辛苦啦，${address}。` : '辛苦啦。'}我帮你记下来了，今晚先别给自己安排太多事情。`
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-500 ring-1 ring-black/5'
      }`}
    >
      {label}
    </button>
  )
}

function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LifePilotPreferences>(DEFAULT_PREFERENCES)
  const [selectedType, setSelectedType] = useState('')
  const recommendation = useMemo(
    () => selectedType ? createPersonalityRecommendation(selectedType) : null,
    [selectedType],
  )
  const preview = useMemo(() => previewFor(draft), [draft])

  const update = <Key extends keyof LifePilotPreferences>(key: Key, value: LifePilotPreferences[Key]) => {
    setDraft((current) => markManualOverride({ ...current, [key]: value }, key))
  }

  const toggleFocusArea = (area: FocusArea) => {
    setDraft((current) => markManualOverride({
      ...current,
      focusAreas: current.focusAreas.includes(area)
        ? current.focusAreas.filter((item) => item !== area)
        : [...current.focusAreas, area],
    }, 'focusAreas'))
  }

  const finish = (preferences = draft) => {
    completeOnboarding(preferences)
    onComplete()
  }

  const skipAll = () => {
    finish(DEFAULT_PREFERENCES)
  }

  const skipPersonality = () => {
    setSelectedType('')
    setStep(2)
  }

  const useRecommendation = () => {
    if (!recommendation) return
    setDraft((current) => applyPersonalityRecommendation(current, recommendation))
    setStep(2)
  }

  const adjustManually = () => {
    setStep(2)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-5 py-6 text-gray-950">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-white">
              <Sparkles size={21} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">LifePilot 初次设置</p>
              <h1 className="text-xl font-semibold tracking-tight">让 AI 更像适合你的管家</h1>
            </div>
          </div>
          <button onClick={skipAll} className="shrink-0 text-xs font-medium text-gray-400">
            暂时跳过
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-gray-950' : 'bg-gray-100'}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">你熟悉自己的16型人格吗？</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                它只用于推荐初始体验，不会定义你，也可以随时修改。
              </p>
            </div>

            {Object.entries(PERSONALITY_GROUPS).map(([group, meta]) => (
              <section key={group}>
                <div className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ACCENT_CLASS[meta.accent]}`}>
                  {meta.label}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {meta.types.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedType(type)
                        setStep(1)
                      }}
                      className="rounded-2xl bg-gray-50 px-2 py-2 text-sm font-semibold text-gray-600 ring-1 ring-black/5"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={skipPersonality}
                className="rounded-full bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 ring-1 ring-black/5"
              >
                我不知道
              </button>
              <button
                onClick={skipPersonality}
                className="rounded-full bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 ring-1 ring-black/5"
              >
                暂时跳过
              </button>
            </div>
          </div>
        )}

        {step === 1 && recommendation && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">根据你的选择，我们先为你推荐：</h2>
              <p className="mt-1 text-sm text-gray-400">这只是初始推荐，后面可以随时覆盖。</p>
            </div>
            <section className={`rounded-3xl p-4 ring-1 ${ACCENT_CLASS[recommendation.themeAccent]}`}>
              <p className="text-xs font-medium opacity-70">{recommendation.type}</p>
              <h3 className="mt-1 text-lg font-semibold">{recommendation.title}</h3>
              <div className="mt-3 space-y-2">
                {recommendation.bullets.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm">
                    <Check size={15} />
                    {item}
                  </p>
                ))}
              </div>
            </section>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={adjustManually}
                className="rounded-full bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 ring-1 ring-black/5"
              >
                自己调整
              </button>
              <button
                onClick={useRecommendation}
                className="rounded-full bg-gray-950 px-4 py-3 text-sm font-medium text-white"
              >
                使用推荐
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">第一步：选择 AI 风格</h2>
              <p className="mt-1 text-sm text-gray-400">固定输入：“今天有点累。”</p>
            </div>
            {PERSONA_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => update('persona', option.value)}
                className={`w-full rounded-3xl p-4 text-left ring-1 transition-colors ${
                  draft.persona === option.value
                    ? 'bg-gray-950 text-white ring-gray-950'
                    : 'bg-gray-50 text-gray-700 ring-black/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{option.label}</h3>
                    <p className={`mt-1 text-xs leading-relaxed ${draft.persona === option.value ? 'text-white/65' : 'text-gray-400'}`}>
                      {option.description}
                    </p>
                  </div>
                  {draft.persona === option.value && <Check size={18} />}
                </div>
                <p className={`mt-3 rounded-2xl px-3 py-2 text-sm leading-relaxed ${draft.persona === option.value ? 'bg-white/10 text-white/85' : 'bg-white text-gray-500'}`}>
                  {option.preview}
                </p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">第二步：选择主要需求</h2>
              <p className="mt-1 text-sm text-gray-400">可以多选，先只用于让 LifePilot 了解你的偏好。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={draft.focusAreas.includes(option.value)}
                  onClick={() => toggleFocusArea(option.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">第三步：交流细节</h2>
              <p className="mt-1 text-sm text-gray-400">这些设置保存后，下一条回复开始生效。</p>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">称呼</h3>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={draft.address === option.value}
                    onClick={() => update('address', option.value)}
                  />
                ))}
              </div>
              {draft.address === 'custom' && (
                <input
                  value={draft.customAddress}
                  onChange={(event) => update('customAddress', event.target.value)}
                  placeholder="输入你想让 LifePilot 使用的称呼"
                  className="mt-2 w-full rounded-2xl border border-black/5 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                />
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">回复长度</h3>
              <div className="flex flex-wrap gap-2">
                {REPLY_LENGTH_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={draft.replyLength === option.value}
                    onClick={() => update('replyLength', option.value)}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">主动程度</h3>
              <div className="flex flex-wrap gap-2">
                {INITIATIVE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={draft.initiative === option.value}
                    onClick={() => update('initiative', option.value)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-400">预览：“今天有点累。”</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">{preview}</p>
            </section>
          </div>
        )}

        {step >= 2 && (
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="rounded-full bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 ring-1 ring-black/5"
            >
              上一步
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep((current) => current + 1)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gray-950 px-4 py-3 text-sm font-medium text-white"
              >
                下一步
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => finish()}
                className="flex-1 rounded-full bg-gray-950 px-4 py-3 text-sm font-medium text-white"
              >
                开始记录
              </button>
            )}
          </div>
        )}

        {step === 4 && (
          <p className="mt-4 text-center text-sm font-medium text-gray-500">你的 LifePilot 已准备好</p>
        )}
      </div>
    </div>
  )
}

export default Onboarding
