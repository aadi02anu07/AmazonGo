/**
 * Amazon Now Snap — Structured Logger
 * 
 * Provides structured JSON logging for CloudWatch.
 * NEVER use console.log in production code - use this logger instead.
 * 
 * Usage:
 *   import { logger } from '@utils/logger';
 *   logger.info({ message: 'Order placed', userId, orderId, total });
 *   logger.error({ message: 'Bedrock timeout', error, userId });
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  message: string;
  [key: string]: unknown;
}

class Logger {
  private serviceName: string;
  private logLevel: LogLevel;

  constructor() {
    this.serviceName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'snap-service';
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(level: LogLevel, context: LogContext): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      ...context,
    };

    // Redact sensitive fields
    return JSON.stringify(this.redactSensitiveData(logEntry));
  }

  private redactSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessKey',
      'secretKey',
      'authorization',
    ];

    const redacted = { ...obj };

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      }

      // Partially redact email
      if (key === 'email' && typeof redacted[key] === 'string') {
        const email = redacted[key] as string;
        const [user, domain] = email.split('@');
        if (user && domain) {
          redacted[key] = `${user.substring(0, 2)}***@${domain}`;
        }
      }

      // Partially redact phone
      if (key === 'phone' && typeof redacted[key] === 'string') {
        const phone = redacted[key] as string;
        redacted[key] = `****${phone.slice(-4)}`;
      }
    }

    return redacted;
  }

  public debug(context: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatLog(LogLevel.DEBUG, context));
    }
  }

  public info(context: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatLog(LogLevel.INFO, context));
    }
  }

  public warn(context: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, context));
    }
  }

  public error(context: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog(LogLevel.ERROR, context));
    }
  }
}

export const logger = new Logger();
