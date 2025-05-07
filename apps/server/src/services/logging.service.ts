/**
 * Simple logging service for the Sitemap Link Extractor API
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: unknown
}

export class LoggingService {
  private static instance: LoggingService
  private minLevel: LogLevel = LogLevel.INFO // Default log level

  private constructor() {}

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService()
    }
    return LoggingService.instance
  }

  public setLogLevel(level: LogLevel): void {
    this.minLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel)
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown
  ): void {
    if (!this.shouldLog(level)) {
      return
    }

    const logEntry = this.formatLog(level, message, context, data)

    // Format console output
    let formattedMessage = `[${logEntry.timestamp}] [${logEntry.level}]`
    if (context) {
      formattedMessage += ` [${context}]`
    }
    formattedMessage += `: ${message}`

    // Log to console with appropriate method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        if (data) console.debug(data)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        if (data) console.info(data)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        if (data) console.warn(data)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        if (data) console.error(data)
        break
    }

    // Additional logging targets could be added here (file, database, etc.)
  }

  public debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data)
  }

  public info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data)
  }

  public warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data)
  }

  public error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data)
  }
}

// Export a singleton instance
export const logger = LoggingService.getInstance()
