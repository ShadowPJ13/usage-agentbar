/** Una ventana de límite: `five_hour` o `seven_day`. */
export type Gauge = {
  kind: string
  /** 0 a 100, con a lo sumo un decimal. */
  percent: number
  /** Cuándo se reinicia, ISO 8601; null si Claude Code no lo informó. */
  resetsAt: string | null
}

/** La ventana de contexto del modelo, tal como la última respuesta la llenó. */
export type ContextGauge = {
  /** 0 a 100. */
  percent: number
  /** Tokens de entrada de la última respuesta. */
  tokens: number
  /** Tamaño de la ventana, en tokens. */
  window: number
}

/** Lo que dibuja la barra: las ventanas, el contexto y el instante con que se calculó la cuenta atrás. */
export type UsageView = { gauges: Gauge[]; context: ContextGauge | null; now: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': { view: UsageView | null; isHidden: boolean }
  }
}
