// La lógica pura de la barra: filas, porcentajes, barras de texto, cuentas atrás y qué cabe en el ancho.
import type { ContextGauge, Gauge, UsageView } from '../types'

export type Level = 'ok' | 'warn' | 'crit'

/** El estilo neón: etiquetas en rosa, cada barra con su color (amarillo al subir, rojo al límite) y las horas en naranja. */
export const PALETTE = {
  limit: '#00b3ff',
  context: '#39ff14',
  warn: '#ffe600',
  crit: '#ff1744',
  text: '#ff7ae0',
  detail: '#ff9e00',
  label: '#5c6b8a',
  separator: '#7a5cff',
} as const

const BAR_FILLED = '▰'
const BAR_EMPTY = '▱'
const WINDOWS = ['five_hour', 'seven_day'] as const

/** De lo que reporta Claude Code, solo las ventanas de 5 horas y semanal, en ese orden. */
export function gaugesOf(rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): Gauge[] {
  return WINDOWS.flatMap(kind => {
    const found = rateLimits.find(r => r.kind === kind)
    return found && Number.isFinite(found.percentUsed)
      ? [{ kind, percent: found.percentUsed, resetsAt: found.resetsAt ?? null }]
      : []
  })
}

/** El contexto, o null hasta que una respuesta lo llene (sesión nueva o recién compactada). */
export function contextOf(context: { tokens?: number; window: number; percent?: number }): ContextGauge | null {
  const { tokens, percent, window } = context
  if (typeof percent !== 'number' || typeof tokens !== 'number' || !Number.isFinite(percent)) return null
  return { percent, tokens, window }
}

export function levelOf(percent: number, warnAt: number, critAt: number): Level {
  return percent >= critAt ? 'crit' : percent >= warnAt ? 'warn' : 'ok'
}

/** `▰▰▰▱▱▱▱▱▱▱` partida en lo lleno y lo vacío, para pintar cada parte de su color. */
export function barParts(percent: number, width: number): { filled: string; empty: string } {
  const clamped = Math.min(100, Math.max(0, percent))
  const count = Math.round((clamped / 100) * width)
  return { filled: BAR_FILLED.repeat(count), empty: BAR_EMPTY.repeat(width - count) }
}

export const percentText = (percent: number): string => `${Math.round(percent)}%`

/** `124k`, `1M`, `1.5M`, `800`. */
export function tokensText(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return String(tokens)
}

/** Tiempo hasta el reinicio: `45m`, `2h 10m`, `1d 10h`; null sin fecha válida; `ya` si pasó. */
export function countdown(resetsAt: string | null, now: number): string | null {
  if (resetsAt === null) return null
  const ms = Date.parse(resetsAt) - now
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'ya'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export type Layout = {
  barWidth: number
  hasDetail: boolean
  /** Las dos ventanas de límite en una sola fila. */
  isOneRow: boolean
  /** El contexto también en esa fila: las tres medidas juntas. */
  isAllOneRow: boolean
}

/**
 * Cuánto detalle cabe en `columns` celdas. Una medida con barra de B celdas ocupa unas 22 + B (5/H),
 * 25 + B (Semana) y 28 + B (Contexto); cada separador, 3.
 */
export function layoutFor(columns: number): Layout {
  if (columns >= 112) return { barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: true }
  if (columns >= 100) return { barWidth: 6, hasDetail: true, isOneRow: true, isAllOneRow: true }
  if (columns >= 70) return { barWidth: 10, hasDetail: true, isOneRow: true, isAllOneRow: false }
  if (columns >= 40) return { barWidth: 10, hasDetail: true, isOneRow: false, isAllOneRow: false }
  if (columns >= 34) return { barWidth: 6, hasDetail: true, isOneRow: false, isAllOneRow: false }
  return { barWidth: 0, hasDetail: false, isOneRow: false, isAllOneRow: false }
}

/** Una medida lista para dibujar. */
export type Row = {
  key: string
  icon: string
  label: string
  iconColor: string
  labelColor: string
  barColor: string
  percent: number
  /** Lo que va entre paréntesis tras el porcentaje; null si no hay o no cabe. */
  detail: string | null
}

export type RowOptions = { warnAt: number; critAt: number; hasContext: boolean }

/** Las filas de la barra, en orden: contexto, 5/H, Semana; cada una solo si hay lectura. */
export function rowsOf(view: UsageView, options: RowOptions, layout: Layout): Row[] {
  const colorOf = (percent: number, base: string): string => {
    const level = levelOf(percent, options.warnAt, options.critAt)
    return level === 'ok' ? base : PALETTE[level]
  }
  const rows: Row[] = []

  if (options.hasContext && view.context) {
    const { percent, tokens, window } = view.context
    rows.push({
      key: 'context',
      icon: '◈',
      label: 'Contexto',
      iconColor: PALETTE.text,
      labelColor: PALETTE.text,
      barColor: colorOf(percent, PALETTE.context),
      percent,
      detail: layout.hasDetail ? `${tokensText(tokens)}/${tokensText(window)}` : null,
    })
  }
  for (const gauge of view.gauges) {
    const isWeek = gauge.kind === 'seven_day'
    const left = layout.hasDetail ? countdown(gauge.resetsAt, view.now) : null
    rows.push({
      key: gauge.kind,
      // Un emoji de dos celdas: los glifos geométricos salen pequeños en la mayoría de fuentes.
      icon: isWeek ? '📅' : '⚡',
      label: isWeek ? 'Semana' : gauge.kind === 'five_hour' ? '5/H' : gauge.kind,
      iconColor: PALETTE.text,
      labelColor: PALETTE.text,
      barColor: colorOf(gauge.percent, PALETTE.limit),
      percent: gauge.percent,
      detail: left === 'ya' ? 'reiniciando' : left,
    })
  }

  return rows
}
