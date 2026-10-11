// usage-bar: el contexto y el % de uso de los límites de 5 horas y semanal, sobre el prompt.
// Lee lo que Claude Code ya reporta (`$.session.usage()` y `session.measure`):
// no hace peticiones ni llama al modelo.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { UsageView } from '../types'
import { barParts, contextOf, gaugesOf, layoutFor, PALETTE, percentText, rowsOf } from './format.js'
import type { Row } from './format.js'

const view = atom({ plugin: 'usage-bar', key: 'view' } as const, null as UsageView | null)
const isHidden = atom({ plugin: 'usage-bar', key: 'isHidden' } as const, false)

// Solo mueve la cuenta atrás: los porcentajes llegan por `session.measure`.
const TICK_MS = 60_000

const number = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

type Measured = Parameters<typeof contextOf>[0]
type Limits = Parameters<typeof gaugesOf>[0]
const viewOf = (usage: { context: Measured; rateLimits: Limits }, now: number): UsageView => ({
  gauges: gaugesOf(usage.rateLimits),
  context: contextOf(usage.context),
  now,
})

export const register: Register = (on, options) => {
  const warnAt = number(options.warnAt, 70)
  const critAt = number(options.critAt, 90)
  const hasContext = options.showContext !== false

  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage().catch(() => null)
    if (usage) {
      const now = await $.clock.now()
      await update($, view, () => viewOf(usage, now))
    }
    await $.command.register({
      name: 'usage-bar',
      description: 'Muestra u oculta la barra de contexto y uso de 5 horas y semanal',
      argumentHint: '[on|off]',
      immediate: true,
    })
    $.clock.every(TICK_MS, async () => {
      const now = await $.clock.now()
      await update($, view, current => (current ? { ...current, now } : current))
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') || e.changed.includes('context')) {
      const now = await $.clock.now()
      await update($, view, () => viewOf(e, now))
    }

    return next(e)
  })

  on('command.run', { command: 'usage-bar' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase()
    const was = await read($, isHidden)
    const hidden = verb === 'off' ? true : verb === 'on' ? false : !was
    await update($, isHidden, () => hidden)

    return { text: hidden ? 'usage-bar oculta' : 'usage-bar visible' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (e.props.hasSurvey || current === null || (await read($, isHidden))) {
      return next(e)
    }
    const layout = layoutFor(e.props.bodyColumns)
    const rows = rowsOf(current, { warnAt, critAt, hasContext }, layout)
    if (rows.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e)

    const part = (row: Row) => {
      const { filled, empty } = barParts(row.percent, layout.barWidth)

      return (
        <Box key={row.key} flexDirection="row" gap={1}>
          <Text color={row.iconColor}>{row.icon}</Text>
          <Text color={row.labelColor}>{row.label}</Text>
          {layout.barWidth > 0 ? (
            <Box flexDirection="row">
              {filled === '' ? null : <Text color={row.barColor}>{filled}</Text>}
              {empty === '' ? null : <Text color={PALETTE.label}>{empty}</Text>}
            </Box>
          ) : null}
          <Text color={row.barColor} bold>
            {percentText(row.percent)}
          </Text>
          {row.detail === null ? null : <Text color={PALETTE.detail}>{`(${row.detail})`}</Text>}
        </Box>
      )
    }

    const context = rows.find(row => row.key === 'context')
    const limits = rows.filter(row => row.key !== 'context')
    // Con sitio, las tres medidas van en una fila; si no, el contexto va solo arriba.
    const inline = layout.isAllOneRow ? rows : limits
    const stacked = layout.isAllOneRow || !context ? [] : [context]
    const inlineParts = inline.flatMap((row, i) =>
      i === 0 || !layout.isOneRow
        ? [part(row)]
        : [
            <Text key={`${row.key}-sep`} color={PALETTE.separator}>
              ❯
            </Text>,
            part(row),
          ],
    )

    return (
      <Box flexDirection="column">
        {stacked.map(part)}
        {inline.length > 0 ? (
          <Box flexDirection={layout.isOneRow ? 'row' : 'column'} gap={layout.isOneRow ? 1 : 0}>
            {inlineParts}
          </Box>
        ) : null}
        {below}
      </Box>
    )
  })
}
