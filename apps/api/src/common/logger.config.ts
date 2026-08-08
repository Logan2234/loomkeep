import type { Params } from "nestjs-pino";

const isDev = process.env.NODE_ENV === "development";

export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    transport: !isDev
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
    // Body is never in these serializers by default (pino-http's req
    // serializer only covers method/url/headers/remoteAddress) — nothing
    // extra to strip there. Headers that can carry a live session do need
    // explicit redaction.
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
      ],
      censor: "[redacted]",
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} -> ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,
  },
};
