import { window, workspace } from 'vscode'

/** Log levels in order of verbosity (lower = more verbose) */
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off'

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4,
}

let outputChannel: ReturnType<typeof window.createOutputChannel> | undefined
let currentLevel: LogLevel = 'info'

const getChannel = (): ReturnType<typeof window.createOutputChannel> => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel('Fancy Crates', 'log')
  }
  return outputChannel
}

/** Format timestamp as HH:MM:SS.mmm for readability */
const formatTime = (): string => {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const millis = now.getMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${millis}`
}

/** Format log level with consistent width */
const formatLevel = (level: string): string => level.toUpperCase().padEnd(5)

/** Check if a message at the given level should be logged */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[currentLevel]
}

/** Update log level from configuration */
const updateLogLevel = (): void => {
  const config = workspace.getConfiguration('fancy-crates')
  const level = config.get<LogLevel>('logLevel') ?? 'info'
  if (level !== currentLevel) {
    currentLevel = level
    // Log the level change at info level (always shown unless off)
    if (level !== 'off') {
      getChannel().appendLine(`${formatTime()} ${formatLevel('info')} Log level set to: ${level}`)
    }
  }
}

const debug = (msg: string) => {
  if (shouldLog('debug')) {
    getChannel().appendLine(`${formatTime()} ${formatLevel('debug')} ${msg}`)
  }
}

const info = (msg: string) => {
  if (shouldLog('info')) {
    getChannel().appendLine(`${formatTime()} ${formatLevel('info')} ${msg}`)
  }
}

const warn = (msg: string) => {
  if (shouldLog('warn')) {
    getChannel().appendLine(`${formatTime()} ${formatLevel('warn')} ${msg}`)
  }
}

const error = (msg: string) => {
  if (shouldLog('error')) {
    getChannel().appendLine(`${formatTime()} ${formatLevel('error')} ${msg}`)
  }
}

const dispose = () => {
  outputChannel?.dispose()
  outputChannel = undefined
}

// Initialize log level from configuration
updateLogLevel()

export default {
  debug,
  info,
  warn,
  error,
  dispose,
  updateLogLevel,
}
