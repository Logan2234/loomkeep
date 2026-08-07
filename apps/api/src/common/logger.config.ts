import type { Params } from "nestjs-pino";

// Structured logging (Observability Palier 1). Decisions locked with Logan
// 2026-08-07: JSON everywhere, pretty-printed only in dev; never log request
// bodies (secrets, and things like a base64 avatar upload are both too big
// and too sensitive); 4xx (expected rejections — NotFoundException,
// ConflictException…) log at "warn", not "error", so real bugs (5xx) aren't
// drowned out.
//
// `isDev`, not `isProd`: NODE_ENV is only ever explicitly set to
// "development" (apps/api's `dev` script, via cross-env) — the Docker image
// never sets it at all (see main.ts's own `isDev` check, same reasoning), so
// a `NODE_ENV === "production"` check would stay false in the real
// deployment too and wrongly pull in pino-pretty (a devDependency) there.
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
