export function parseExpenseAmount(text: string): number | null {
  const currencyAmount = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(?:元|块钱|块)/)
    ?? text.match(/(?:花了|消费|支付|付款)(?:人民币)?\s*(\d+(?:\.\d+)?)(?!\s*(?:件|个|杯|份|张|本))/)
  if (!currencyAmount) return null

  const value = Number(currencyAmount[1])
  return Number.isFinite(value) ? value : null
}
