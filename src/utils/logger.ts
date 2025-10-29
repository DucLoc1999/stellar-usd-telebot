// Simple logger utility
export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    console.warn(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEBUG] ${message}`, ...args);
    }
  },
};

export default logger;
