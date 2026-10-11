// agents-bar: los subagentes lanzados en la sesión, sobre el prompt. Lee `$.agent.list()` (la lista
// que Claude Code ya lleva): no hace peticiones ni llama al modelo.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentsView } from '../types'
import { countsOf, duration, EMPTY_VIEW, isLive, isVisible, markOf, merge, PALETTE, sameAgents, truncate } from './agents.js'

const view = atom({ plugin: 'agents-bar', key: 'view' } as const, EMPTY_VIEW as AgentsView)
const isHidden = atom({ plugin: 'agents-bar', key: 'isHidden' } as const, false)

// Cada cuánto se mira la lista: mueve también los cronómetros mientras haya agentes a la vista.
const TICK_MS = 2_000

const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback

export const register: Register = (on, options) => {
  const maxActive = count(options.maxActive, 5)
  const showFinished = count(options.showFinished, 2)
  const lingerMs = count(options.lingerSeconds, 60) * 1000

  on('session.start', async ($, e, next) => {
    const refresh = async () => {
      const [listed, now, prev] = await Promise.all([$.agent.list().catch(() => null), $.clock.now(), read($, view)])
      if (listed === null) return
      const merged = merge(prev, listed, now)
      // Sin cambios y fuera de la vista no hay nada que escribir; a la vista, el reloj avanza.
      if (sameAgents(prev, merged) && !isVisible(prev, prev.now, lingerMs) && !isVisible(merged, now, lingerMs)) return
      await update($, view, current => merge(current, listed, now))
    }

    await $.command.register({
      name: 'agents-bar',
      description: 'Muestra u oculta la barra de agentes lanzados',
      argumentHint: '[on|off]',
      immediate: true,
    })
    $.clock.every(TICK_MS, () => void refresh().catch(() => {}))
    void refresh().catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'agents-bar' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase()
    const was = await read($, isHidden)
    const hidden = verb === 'off' ? true : verb === 'on' ? false : !was
    await update($, isHidden, () => hidden)

    return { text: hidden ? 'agents-bar oculta' : 'agents-bar visible' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (e.props.hasSurvey || !isVisible(current, current.now, lingerMs) || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const live = current.rows.filter(isLive)
    const shown = live.slice(0, maxActive)
    const hiddenCount = live.length - shown.length
    const finished = current.rows.filter(row => !isLive(row)).slice(0, showFinished)
    const below = await next(e)

    const line = (row: AgentsView['rows'][number]) => {
      const mark = markOf(row.status)
      const ms = (row.endedAt ?? current.now) - row.startedAt
      const room = Math.max(10, e.props.bodyColumns - row.label.length - 18)

      return (
        <Box key={row.id} flexDirection="row" gap={1} paddingLeft={2}>
          <Text color={mark.color}>{mark.glyph}</Text>
          <Text color={isLive(row) ? PALETTE.title : PALETTE.label} bold={isLive(row)}>
            {row.label}
          </Text>
          <Text color={PALETTE.label}>{truncate(row.description, room)}</Text>
          <Text color={PALETTE.time}>{duration(ms)}</Text>
        </Box>
      )
    }
    const counts = countsOf(current)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={PALETTE.label}>◈</Text>
          <Text color={PALETTE.title} bold>
            Agentes
          </Text>
          <Text color={PALETTE.separator}>❯</Text>
          <Text color={counts.active > 0 ? PALETTE.active : PALETTE.label} bold={counts.active > 0}>
            {counts.activeText}
          </Text>
          <Text color={PALETTE.separator}>❯</Text>
          <Text color={PALETTE.launched} bold>
            {counts.launchedText}
          </Text>
        </Box>
        {shown.map(line)}
        {hiddenCount > 0 ? (
          <Box paddingLeft={2}>
            <Text color={PALETTE.label}>{`+${hiddenCount} más`}</Text>
          </Box>
        ) : null}
        {finished.map(line)}
        {below}
      </Box>
    )
  })
}
