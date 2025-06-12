import pino from "pino";

export const logger = pino({
  level: process.env.PINO_LOG_LEVEL ?? "info",
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});
