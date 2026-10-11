/** Un agente visto en la sesión; `endedAt` es null mientras siga vivo. */
export type AgentRow = {
  id: string
  /** El nombre con que se le escribe, o su tipo (`Explore`, `general-purpose`...). */
  label: string
  description: string
  /** El estado de `$.agent.list()`; `completed` cuando dejó de listarse sin decir más. */
  status: string
  startedAt: number
  endedAt: number | null
}

/** Lo que dibuja la barra: las filas, cuántos agentes se han visto en total y el instante del cálculo. */
export type AgentsView = { rows: AgentRow[]; launched: number; now: number }

declare module 'claude-code' {
  interface PluginState {
    'agents-bar': { view: AgentsView; isHidden: boolean }
  }
}
