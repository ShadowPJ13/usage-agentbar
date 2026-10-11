import { expect, test } from 'claude-code/testing'

import type { AgentsView } from '../types'
import { countsOf, duration, EMPTY_VIEW, isVisible, markOf, merge, PALETTE, sameAgents, truncate } from './agents'
import type { ListedAgent } from './agents'

const agent = (id: string, status = 'running', extra: Partial<ListedAgent> = {}): ListedAgent => ({
  id,
  type: 'Explore',
  description: `tarea ${id}`,
  status,
  ...extra,
})

test('a new agent is counted once and starts now', () => {
  const first = merge(EMPTY_VIEW, [agent('a')], 1000)
  expect(first.launched).toBe(1)
  expect(first.rows[0]).toEqual({ id: 'a', label: 'Explore', description: 'tarea a', status: 'running', startedAt: 1000, endedAt: null })

  const again = merge(first, [agent('a')], 5000)
  expect(again.launched).toBe(1)
  expect(again.rows[0]?.startedAt).toBe(1000)
})

test('the name wins over the type as the label', () => {
  const view = merge(EMPTY_VIEW, [agent('a', 'running', { name: 'revisor' })], 0)
  expect(view.rows[0]?.label).toBe('revisor')
})

test('a listed agent that ends keeps its end time', () => {
  const running = merge(EMPTY_VIEW, [agent('a')], 1000)
  const done = merge(running, [agent('a', 'completed')], 4000)
  expect(done.rows[0]?.endedAt).toBe(4000)
  const later = merge(done, [agent('a', 'completed')], 9000)
  expect(later.rows[0]?.endedAt).toBe(4000)
})

test('an agent the engine stops listing is kept as completed', () => {
  const running = merge(EMPTY_VIEW, [agent('a'), agent('b')], 1000)
  const after = merge(running, [agent('b')], 3000)
  const a = after.rows.find(row => row.id === 'a')
  expect(a?.status).toBe('completed')
  expect(a?.endedAt).toBe(3000)
  expect(after.launched).toBe(2)
})

test('an agent that was finished and unlisted stays as it was', () => {
  const failed = merge(merge(EMPTY_VIEW, [agent('a')], 1000), [agent('a', 'failed')], 2000)
  const gone = merge(failed, [], 9000)
  expect(gone.rows[0]).toEqual(failed.rows[0])
})

test('live agents come first and only the latest finished are kept', () => {
  let view: AgentsView = EMPTY_VIEW
  for (let i = 0; i < 20; i++) view = merge(view, [agent(`old${i}`)], i * 10)
  view = merge(view, [agent('live')], 1000)
  expect(view.rows[0]?.id).toBe('live')
  expect(view.rows.length).toBe(13)
  expect(view.launched).toBe(21)
})

test('isVisible: live agents, then a grace period after the last one ends', () => {
  const running = merge(EMPTY_VIEW, [agent('a')], 1000)
  expect(isVisible(running, 999_999, 60_000)).toBe(true)
  const done = merge(running, [agent('a', 'completed')], 5000)
  expect(isVisible(done, 5000 + 59_999, 60_000)).toBe(true)
  expect(isVisible(done, 5000 + 60_000, 60_000)).toBe(false)
  expect(isVisible(done, 5000, 0)).toBe(false)
  expect(isVisible(EMPTY_VIEW, 5000, 60_000)).toBe(false)
})

test('sameAgents ignores the clock but not rows or the total', () => {
  const view = merge(EMPTY_VIEW, [agent('a')], 1000)
  expect(sameAgents(view, { ...view, now: 9999 })).toBe(true)
  expect(sameAgents(view, { ...view, launched: 5 })).toBe(false)
  expect(sameAgents(view, merge(view, [agent('a', 'completed')], 2000))).toBe(false)
})

test('duration reads seconds, minutes and hours', () => {
  expect(duration(-5)).toBe('0s')
  expect(duration(45_000)).toBe('45s')
  expect(duration(72_000)).toBe('1m12s')
  expect(duration(3_900_000)).toBe('1h05m')
})

test('truncate collapses whitespace and cuts with an ellipsis', () => {
  expect(truncate('  a\n  b  ', 20)).toBe('a b')
  expect(truncate('abcdefghij', 5)).toBe('abcd…')
})

test('markOf gives each state its neon glyph and color', () => {
  expect(markOf('running')).toEqual({ glyph: '◌', color: PALETTE.title })
  expect(markOf('completed')).toEqual({ glyph: '◉', color: PALETTE.active })
  expect(markOf('waiting').glyph).toBe('◐')
  expect(markOf('failed')).toEqual({ glyph: '✗', color: PALETTE.failed })
  expect(markOf('killed').glyph).toBe('■')
})

test('countsOf writes the header counters in Spanish, singular and plural', () => {
  const one = merge(EMPTY_VIEW, [agent('a'), agent('b', 'completed')], 0)
  expect(countsOf(one)).toEqual({ active: 1, activeText: '1 activo', launchedText: '2 lanzados' })
  const many = merge(EMPTY_VIEW, [agent('a'), agent('b')], 0)
  expect(countsOf(many).activeText).toBe('2 activos')
  expect(countsOf(merge(EMPTY_VIEW, [agent('a')], 0)).launchedText).toBe('1 lanzado')
  expect(countsOf(EMPTY_VIEW).activeText).toBe('0 activos')
})
