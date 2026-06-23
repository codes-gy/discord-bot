import { formatDate } from './dateUtil';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
    private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
        const timestamp = formatDate(new Date());
        const extra = args.length ? ` | data: ${this.safeStringify(args)}` : '';
        return `[${timestamp}] [${level}] ${message}${extra}`;
    }

    private safeStringify(value: unknown): string {
        try {
            return JSON.stringify(value);
        } catch {
            return '[Unserializable Data]';
        }
    }

    info(message: string, ...args: unknown[]) {
        console.log(this.formatMessage('INFO', message, ...args));
    }

    warn(message: string, ...args: unknown[]) {
        console.warn(this.formatMessage('WARN', message, ...args));
    }

    error(message: string, error?: unknown, ...args: unknown[]) {
        const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
        console.error(this.formatMessage('ERROR', message, ...args));
        if (error) {
            console.error(`🔻 Stack Trace:\n${errorMessage}`);
        }
    }

    debug(message: string, ...args: unknown[]) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(this.formatMessage('DEBUG', message, ...args));
        }
    }
}

export const logger = new Logger();
