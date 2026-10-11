// La lógica pura de la barra: fusionar la lista de agentes con lo ya visto y dar formato.
import type { AgentRow, AgentsView } from '../types'

/** Lo que la barra lee de `$.agent.list()`. */
export type ListedAgent = { id: string; name?: string; type: string; description: string; status: string }

export const EMPTY_VIEW: AgentsView = { rows: [], launched: 0, now: 0 }

// `idle` es un compañero entre turnos: sigue vivo, pero no trabaja.
const LIVE = new Set(['pending', 'running', 'waiting', 'idle'])
const FINISHED_KEPT = 12

export const isLive = (row: AgentRow): boolean => row.endedAt === null

/**
 * Suma lo que lista el motor a lo ya visto. `$.agent.list()` olvida un agente segundos después de
 * que termina, así que los que dejan de aparecer se guardan como terminados.
 */
export function merge(prev: AgentsView, listed: readonly ListedAgent[], now: number): AgentsView {
  const before = new Map(prev.rows.map(row => [row.id, row]))
  const seen = new Set(listed.map(agent => agent.id))
  let launched = prev.launched

  const rows: AgentRow[] = listed.map(agent => {
    const old = before.get(agent.id)
    if (!old) launched += 1
    return {
      id: agent.id,
      label: agent.name || agent.type,
      description: agent.description,
      status: agent.status,
      startedAt: old?.startedAt ?? now,
      endedAt: LIVE.has(agent.status) ? null : (old?.endedAt ?? now),
    }
  })
  for (const row of prev.rows) {
    if (seen.has(row.id)) continue
    rows.push(isLive(row) ? { ...row, status: 'completed', endedAt: now } : row)
  }

  const live = rows.filter(isLive)
  const finished = rows
    .filter(row => !isLive(row))
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, FINISHED_KEPT)

  return { rows: [...live, ...finished], launched, now }
}

/** Si la barra se dibuja: hay agentes vivos, o alguno terminó hace menos de `lingerMs`. */
export function isVisible(view: AgentsView, now: number, lingerMs: number): boolean {
  if (view.rows.some(isLive)) return true
  const last = Math.max(0, ...view.rows.map(row => row.endedAt ?? 0))
  return last > 0 && now - last < lingerMs
}

/** Las mismas filas y el mismo total: lo que hace falta redibujar aunque pase el tiempo. */
export const sameAgents = (a: AgentsView, b: AgentsView): boolean =>
  a.launched === b.launched && JSON.stringify(a.rows) === JSON.stringify(b.rows)

/** `45s`, `1m12s`, `1h05m`. */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

export function truncate(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length <= max ? line : `${line.slice(0, Math.max(0, max - 1))}…`
}

/** El estilo neón: cian al trabajar, verde al terminar, amarillo a la espera, rojo al fallar. */
export const PALETTE = {
  title: '#00e5ff',
  active: '#39ff14',
  launched: '#ff2bd6',
  time: '#ff9e00',
  warning: '#ffe600',
  failed: '#ff1744',
  label: '#5c6b8a',
  separator: '#7a5cff',
} as const

/** El glifo y el color de cada estado. */
export function markOf(status: string): { glyph: string; color: string } {
  switch (status) {
    case 'running':
    case 'pending':
      return { glyph: '◌', color: PALETTE.title }
    case 'waiting':
      return { glyph: '◐', color: PALETTE.warning }
    case 'idle':
      return { glyph: '○', color: PALETTE.label }
    case 'completed':
      return { glyph: '◉', color: PALETTE.active }
    case 'failed':
      return { glyph: '✗', color: PALETTE.failed }
    default:
      return { glyph: '■', color: PALETTE.time }
  }
}

/** Los dos contadores de la cabecera: `2 activos` y `7 lanzados`, con su número aparte. */
export function countsOf(view: AgentsView): { active: number; activeText: string; launchedText: string } {
  const active = view.rows.filter(isLive).length
  return {
    active,
    activeText: `${active} ${active === 1 ? 'activo' : 'activos'}`,
    launchedText: `${view.launched} ${view.launched === 1 ? 'lanzado' : 'lanzados'}`,
  }
}
