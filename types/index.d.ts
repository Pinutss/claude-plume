export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

declare module 'claude-code' {
  interface PluginState {
    plume: {
      model: string
      effort: Effort
      isBusy: boolean
      previous: string | null
    }
  }
}
