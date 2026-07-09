function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function inferTodoDueDate(text: string): string | undefined {
  const today = new Date()

  if (text.includes('明天')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return formatDateKey(tomorrow)
  }

  if (text.includes('今天')) {
    return formatDateKey(today)
  }

  return undefined
}
