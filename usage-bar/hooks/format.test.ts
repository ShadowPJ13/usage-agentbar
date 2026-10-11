import { expect, test } from 'claude-code/testing'

import type { UsageView } from '../types'
import { barParts, contextOf, countdown, gaugesOf, layoutFor, levelOf, PALETTE, percentText, rowsOf, tokensText } from './format'

const NOW = Date.parse('2026-10-11T12:00:00Z')
const at = (ms: number) => new Date(NOW + ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const OPTIONS = { warnAt: 70, critAt: 90, hasContext: true }
const WIDE = layoutFor(120)

const view = (over: Partial<UsageView> = {}): UsageView => ({
  gauges: [
    { kind: 'five_hour', percent: 8, resetsAt: at(HOUR + 15 * MIN) },
    { kind: 'seven_day', percent: 38, resetsAt: at(10 * HOUR + 35 * MIN) },
  ],
  context: { percent: 62, tokens: 124_000, window: 200_000 },
  now: NOW,
  ...over,
})

test('gaugesOf keeps only the 5-hour and weekly windows, in that order', () => {
  const gauges = gaugesOf([
    { kind: 'spend_limit', percentUsed: 5 },
    { kind: 'seven_day', percentUsed: 18, resetsAt: '2026-10-14T00:00:00Z' },
    { kind: 'five_hour', percentUsed: 42.5 },
  ])
  expect(gauges).toEqual([
    { kind: 'five_hour', percent: 42.5, resetsAt: null },
    { kind: 'seven_day', percent: 18, resetsAt: '2026-10-14T00:00:00Z' },
  ])
})

test('gaugesOf is empty with no reading and drops a non-finite one', () => {
  expect(gaugesOf([])).toEqual([])
  expect(gaugesOf([{ kind: 'five_hour', percentUsed: Number.NaN }])).toEqual([])
})

test('contextOf needs both the percent and the tokens', () => {
  expect(contextOf({ tokens: 124_000, window: 200_000, percent: 62 })).toEqual({ percent: 62, tokens: 124_000, window: 200_000 })
  expect(contextOf({ window: 200_000 })).toBe(null)
  expect(contextOf({ window: 200_000, percent: 5 })).toBe(null)
})

test('levelOf switches at the thresholds', () => {
  expect(levelOf(69.9, 70, 90)).toBe('ok')
  expect(levelOf(70, 70, 90)).toBe('warn')
  expect(levelOf(89, 70, 90)).toBe('warn')
  expect(levelOf(90, 70, 90)).toBe('crit')
  expect(levelOf(120, 70, 90)).toBe('crit')
})

test('barParts fills proportionally with thin bars and clamps', () => {
  expect(barParts(0, 10)).toEqual({ filled: '', empty: '▱▱▱▱▱▱▱▱▱▱' })
  expect(barParts(50, 10)).toEqual({ filled: '▰▰▰▰▰', empty: '▱▱▱▱▱' })
  expect(barParts(100, 10)).toEqual({ filled: '▰▰▰▰▰▰▰▰▰▰', empty: '' })
  expect(barParts(250, 4)).toEqual({ filled: '▰▰▰▰', empty: '' })
  expect(barParts(-5, 4)).toEqual({ filled: '', empty: '▱▱▱▱' })
})

test('percentText rounds', () => {
  expect(percentText(42.5)).toBe('43%')
  expect(percentText(7)).toBe('7%')
})

test('tokensText abbreviates', () => {
  expect(tokensText(800)).toBe('800')
  expect(tokensText(124_000)).toBe('124k')
  expect(tokensText(200_000)).toBe('200k')
  expect(tokensText(1_000_000)).toBe('1M')
  expect(tokensText(1_500_000)).toBe('1.5M')
})

test('countdown reads minutes, hours and days', () => {
  expect(countdown(at(30_000), NOW)).toBe('<1m')
  expect(countdown(at(45 * MIN), NOW)).toBe('45m')
  expect(countdown(at(2 * HOUR + 10 * MIN), NOW)).toBe('2h 10m')
  expect(countdown(at(2 * HOUR + 5 * MIN), NOW)).toBe('2h 05m')
  expect(countdown(at(24 * HOUR + 10 * HOUR), NOW)).toBe('1d 10h')
})

test('countdown handles missing, past and invalid dates', () => {
  expect(countdown(null, NOW)).toBe(null)
  expect(countdown('no es una fecha', NOW)).toBe(null)
  expect(countdown(at(-MIN), NOW)).toBe('ya')
})

test('layoutFor puts the three measures in one row when they fit, and drops detail as the band narrows', () => {
  expect(layoutFor(130)).toEqual({ barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: true })
  expect(layoutFor(112)).toEqual({ barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: true })
  expect(layoutFor(105)).toEqual({ barWidth: 6, hasDetail: true, isOneRow: true, isAllOneRow: true })
  expect(layoutFor(99)).toEqual({ barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: false })
  expect(layoutFor(70)).toEqual({ barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: false })
  expect(layoutFor(69)).toEqual({ barWidth: 10, hasDetail: true, isOneRow: false, isAllOneRow: false })
  expect(layoutFor(36)).toEqual({ barWidth: 6, hasDetail: true, isOneRow: false, isAllOneRow: false })
  expect(layoutFor(30)).toEqual({ barWidth: 0, hasDetail: false, isOneRow: false, isAllOneRow: false })
})

test('rowsOf orders context, 5/H and Semana, with the details asked for', () => {
  const rows = rowsOf(view(), OPTIONS, WIDE)
  expect(rows.map(r => [r.key, r.label, r.detail])).toEqual([
    ['context', 'Contexto', '124k/200k'],
    ['five_hour', '5/H', '1h 15m'],
    ['seven_day', 'Semana', '10h 35m'],
  ])
})

test('Semana gets the big icon, and every label and icon is pink', () => {
  const rows = rowsOf(view(), OPTIONS, WIDE)
  expect(rows.find(r => r.key === 'seven_day')?.icon).toBe('📅')
  expect(rows.find(r => r.key === 'five_hour')?.icon).toBe('⚡')
  expect(rows.map(r => r.labelColor)).toEqual([PALETTE.text, PALETTE.text, PALETTE.text])
  expect(rows.map(r => r.iconColor)).toEqual([PALETTE.text, PALETTE.text, PALETTE.text])
})

test('the details have a color of their own, apart from the pink text and the muted bar', () => {
  expect(PALETTE.detail).toBe('#ff9e00')
  expect(new Set([PALETTE.detail, PALETTE.text, PALETTE.label]).size).toBe(3)
})

test('each measure keeps its color until a threshold, then yellow, then red', () => {
  const at = (percent: number) => rowsOf(view({ context: { percent, tokens: 1, window: 2 }, gauges: [{ kind: 'five_hour', percent, resetsAt: null }] }), OPTIONS, WIDE)
  expect(at(10).map(r => r.barColor)).toEqual([PALETTE.context, PALETTE.limit])
  expect(at(75).map(r => r.barColor)).toEqual([PALETTE.warn, PALETTE.warn])
  expect(at(95).map(r => r.barColor)).toEqual([PALETTE.crit, PALETTE.crit])
})

test('rowsOf leaves out the context when off or not yet read, and the limits when absent', () => {
  expect(rowsOf(view(), { ...OPTIONS, hasContext: false }, WIDE).map(r => r.key)).toEqual(['five_hour', 'seven_day'])
  expect(rowsOf(view({ context: null }), OPTIONS, WIDE).map(r => r.key)).toEqual(['five_hour', 'seven_day'])
  expect(rowsOf(view({ gauges: [] }), OPTIONS, WIDE).map(r => r.key)).toEqual(['context'])
  expect(rowsOf(view({ gauges: [], context: null }), OPTIONS, WIDE)).toEqual([])
})

test('narrow layouts drop the details, and a passed reset reads reiniciando', () => {
  const narrow = rowsOf(view(), OPTIONS, layoutFor(20))
  expect(narrow.map(r => r.detail)).toEqual([null, null, null])
  const passed = rowsOf(view({ gauges: [{ kind: 'five_hour', percent: 3, resetsAt: at(-MIN) }] }), OPTIONS, WIDE)
  expect(passed.find(r => r.key === 'five_hour')?.detail).toBe('reiniciando')
})
