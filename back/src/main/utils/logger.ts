// Journal console minimal : une app de bureau n'a pas d'agrégateur de logs à alimenter.
export type Logger = {
  info: (context: object, message: string) => void
  warn: (context: object, message: string) => void
  error: (context: object, message: string) => void
}

const line = (level: string) => (context: object, message: string) =>
  console[level === 'info' ? 'log' : (level as 'warn' | 'error')](
    `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`,
    Object.keys(context).length ? context : '',
  )

export const logger: Logger = {
  info: line('info'),
  warn: line('warn'),
  error: line('error'),
}
