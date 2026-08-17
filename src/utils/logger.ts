function timestamp(): string {
    return new Date().toISOString();
}

export const logger = {
    info: (message: string, ...meta: unknown[]): void => {
        console.log(`[INFO] ${timestamp()} ${message}`, ...meta);
    },
    warn: (message: string, ...meta: unknown[]): void => {
        console.warn(`[WARN] ${timestamp()} ${message}`, ...meta);
    },
    error: (message: string, ...meta: unknown[]): void => {
        console.error(`[ERROR] ${timestamp()} ${message}`, ...meta);
    },
    debug: (message: string, ...meta: unknown[]): void => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[DEBUG] ${timestamp()} ${message}`, ...meta);
        }
    },
};
