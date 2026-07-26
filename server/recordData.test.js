import assert from 'node:assert/strict'
import test from 'node:test'
import { parseExpenseAmount } from './recordData.js'

test('extracts explicit expense amounts without treating quantities as money', () => {
  assert.equal(parseExpenseAmount('今天花了28元买咖啡'), 28)
  assert.equal(parseExpenseAmount('打车花了35.5'), 35.5)
  assert.equal(parseExpenseAmount('支付￥19.9'), 19.9)
  assert.equal(parseExpenseAmount('今天买了两件衣服'), undefined)
  assert.equal(parseExpenseAmount('今天花了很多钱'), undefined)
})
